use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

struct ServerChild(Mutex<Option<Child>>);

fn repo_root() -> PathBuf {
  if let Ok(root) = std::env::var("RESUME_ROOT") {
    return PathBuf::from(root);
  }
  // apps/desktop/src-tauri → repo root (../../../)
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .canonicalize()
    .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn spawn_local_server(app: &tauri::AppHandle) -> Result<Child, String> {
  let root = repo_root();
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  // Per-user empty-or-existing DB under OS app data — never copy developer ./data/
  // and never bundle resume.db into the installer resources.
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let db_path = data_dir.join("resume.db");

  let static_dir = {
    let bundled = app
      .path()
      .resource_dir()
      .ok()
      .map(|r| r.join("web-dist"));
    if let Some(ref p) = bundled {
      if p.join("index.html").exists() {
        p.clone()
      } else {
        root.join("apps/web/dist")
      }
    } else {
      root.join("apps/web/dist")
    }
  };

  if !static_dir.join("index.html").exists() {
    return Err(format!(
      "web dist missing at {} — run: npm run build -w @resume/web",
      static_dir.display()
    ));
  }

  let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
  let mut cmd = Command::new("npm");
  cmd
    .args(["run", "start", "-w", "@resume/server"])
    .current_dir(&root)
    .env("RESUME_DB_PATH", &db_path)
    .env("RESUME_STATIC_DIR", &static_dir)
    .env("HOST", "127.0.0.1")
    .env("PORT", &port)
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  cmd.spawn().map_err(|e| {
    format!("failed to spawn npm server (is Node/npm on PATH?): {e}")
  })
}

fn wait_for_health(port: &str) -> Result<(), String> {
  let url = format!("http://127.0.0.1:{port}/health");
  for _ in 0..60 {
    let status = Command::new("curl")
      .args(["-sf", &url])
      .stdout(Stdio::null())
      .stderr(Stdio::null())
      .status();
    if let Ok(s) = status {
      if s.success() {
        return Ok(());
      }
    }
    std::thread::sleep(std::time::Duration::from_millis(250));
  }
  Err(format!("server did not become healthy at {url}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ServerChild(Mutex::new(None)))
    .setup(|app| {
      let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
      let child = spawn_local_server(app.handle()).unwrap_or_else(|e| {
        panic!("[resume-desktop] {e}");
      });
      {
        let state = app.state::<ServerChild>();
        *state.0.lock().unwrap() = Some(child);
      }
      wait_for_health(&port).unwrap_or_else(|e| {
        panic!("[resume-desktop] {e}");
      });

      if let Some(win) = app.get_webview_window("main") {
        let url = format!("http://127.0.0.1:{port}/");
        let _ = win.eval(&format!("window.location.replace('{url}')"));
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        let app = window.app_handle();
        if let Some(state) = app.try_state::<ServerChild>() {
          if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
              let _ = child.kill();
            }
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
