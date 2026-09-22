use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

struct ServerChild(Mutex<Option<Child>>);

fn repo_root() -> PathBuf {
  if let Ok(root) = std::env::var("RESUME_ROOT") {
    return PathBuf::from(root);
  }
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .canonicalize()
    .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn find_node() -> Result<PathBuf, String> {
  if let Ok(p) = std::env::var("RESUME_NODE") {
    let pb = PathBuf::from(p);
    if pb.exists() {
      return Ok(pb);
    }
  }
  // Prefer `node` on PATH (Mac/Windows/Linux).
  let which = if cfg!(windows) { "where" } else { "which" };
  if let Ok(out) = Command::new(which).arg("node").output() {
    if out.status.success() {
      let text = String::from_utf8_lossy(&out.stdout);
      if let Some(line) = text.lines().next() {
        let p = PathBuf::from(line.trim());
        if p.exists() {
          return Ok(p);
        }
      }
    }
  }
  Err(
    "未找到 Node.js（需要 22+）。请安装 https://nodejs.org 后重开拼履，或设置环境变量 RESUME_NODE。"
      .into(),
  )
}

struct RuntimePaths {
  static_dir: PathBuf,
  server_entry: PathBuf,
  templates_dir: PathBuf,
  /// When true, spawn `node server.mjs`; else monorepo `npm run start`.
  packaged: bool,
}

fn resolve_paths(app: &tauri::AppHandle) -> Result<RuntimePaths, String> {
  if let Ok(res) = app.path().resource_dir() {
    let server_entry = res.join("server").join("server.mjs");
    let templates_dir = res.join("templates");
    let static_dir = res.join("web-dist");
    if server_entry.is_file() && static_dir.join("index.html").is_file() {
      return Ok(RuntimePaths {
        static_dir,
        server_entry,
        templates_dir,
        packaged: true,
      });
    }
  }

  let root = repo_root();
  let static_dir = root.join("apps/web/dist");
  if !static_dir.join("index.html").is_file() {
    return Err(format!(
      "web dist missing at {} — run: npm run desktop:prepare",
      static_dir.display()
    ));
  }
  Ok(RuntimePaths {
    static_dir,
    server_entry: root.join("apps/server/src/index.ts"),
    templates_dir: root.join("templates"),
    packaged: false,
  })
}

fn spawn_local_server(app: &tauri::AppHandle) -> Result<Child, String> {
  let paths = resolve_paths(app)?;
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  // Per-user DB under OS app data — never copy developer ./data/ into the bundle.
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let db_path = data_dir.join("resume.db");

  let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
  let mut cmd = if paths.packaged {
    let node = find_node()?;
    let mut c = Command::new(node);
    c.arg(&paths.server_entry);
    c
  } else {
    let root = repo_root();
    let mut c = Command::new("npm");
    c.args(["run", "start", "-w", "@resume/server"])
      .current_dir(&root);
    c
  };

  cmd
    .env("RESUME_DB_PATH", &db_path)
    .env("RESUME_STATIC_DIR", &paths.static_dir)
    .env("RESUME_TEMPLATES_DIR", &paths.templates_dir)
    .env("HOST", "127.0.0.1")
    .env("PORT", &port)
    .stdout(Stdio::null())
    .stderr(Stdio::null());

  cmd.spawn().map_err(|e| format!("failed to spawn API server: {e}"))
}

fn wait_for_health(port: &str) -> Result<(), String> {
  let addr = format!("127.0.0.1:{port}");
  for _ in 0..80 {
    if TcpStream::connect_timeout(
      &addr
        .parse()
        .map_err(|e| format!("bad address {addr}: {e}"))?,
      Duration::from_millis(200),
    )
    .is_ok()
    {
      // Port open — give Fastify a beat to finish listen.
      std::thread::sleep(Duration::from_millis(150));
      return Ok(());
    }
    std::thread::sleep(Duration::from_millis(250));
  }
  Err(format!("server did not become healthy at http://{addr}/"))
}

fn kill_child_tree(child: &mut Child) {
  let _ = child.kill();
  let _ = child.wait();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(ServerChild(Mutex::new(None)))
    .setup(|app| {
      let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
      let child = spawn_local_server(app.handle()).unwrap_or_else(|e| {
        panic!("[拼履] {e}");
      });
      {
        let state = app.state::<ServerChild>();
        *state.0.lock().unwrap() = Some(child);
      }
      wait_for_health(&port).unwrap_or_else(|e| {
        panic!("[拼履] {e}");
      });

      if let Some(win) = app.get_webview_window("main") {
        let url = format!("http://127.0.0.1:{port}/");
        let _ = win.eval(&format!("window.location.replace('{url}')"));
      }

      // Quiet background update check (signed GitHub latest.json).
      let handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        if let Err(e) = check_and_install_update(handle).await {
          log::info!("[拼履] updater: {e}");
        }
      });

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        let app = window.app_handle();
        if let Some(state) = app.try_state::<ServerChild>() {
          if let Ok(mut guard) = state.0.lock() {
            if let Some(mut child) = guard.take() {
              kill_child_tree(&mut child);
            }
          }
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

async fn check_and_install_update(app: tauri::AppHandle) -> Result<(), String> {
  use tauri_plugin_updater::UpdaterExt;
  let updater = app.updater().map_err(|e| e.to_string())?;
  match updater.check().await {
    Ok(Some(update)) => {
      log::info!(
        "[拼履] update available {} → {}",
        update.current_version,
        update.version
      );
      update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|e| e.to_string())?;
      app.restart();
    }
    Ok(None) => {
      log::info!("[拼履] updater: already latest");
      Ok(())
    }
    Err(e) => Err(e.to_string()),
  }
}

#[allow(dead_code)]
fn _path_exists(p: &Path) -> bool {
  p.exists()
}
