use std::fs::OpenOptions;
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use base64::Engine as _;
use tauri::Manager;

pub mod core;

struct ServerChild(Mutex<Option<Child>>);

#[derive(Clone, Copy, PartialEq, Eq)]
enum ApiBackend {
  /// Default — in-process Rust HTTP (CRUD + photo + DOCX export). No Node required.
  Rust,
  /// Dev-only escape hatch: spawn monorepo `npm run start -w @resume/server`.
  /// Ignored / rejected for packaged installs.
  Node,
}

fn api_backend() -> ApiBackend {
  match std::env::var("RESUME_API")
    .unwrap_or_else(|_| "rust".into())
    .to_ascii_lowercase()
    .as_str()
  {
    "node" => ApiBackend::Node,
    _ => ApiBackend::Rust,
  }
}

fn repo_root() -> PathBuf {
  if let Ok(root) = std::env::var("RESUME_ROOT") {
    return PathBuf::from(root);
  }
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .canonicalize()
    .unwrap_or_else(|_| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../.."))
}

fn app_log_hint(data_dir: &Path) -> String {
  #[cfg(target_os = "macos")]
  {
    let _ = data_dir;
    "日志：~/Library/Application Support/com.pinlu.desktop/server.log".into()
  }
  #[cfg(target_os = "windows")]
  {
    format!("日志：{}\\server.log", data_dir.display())
  }
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  {
    format!("日志：{}/server.log", data_dir.display())
  }
}

fn show_startup_error(message: &str) {
  eprintln!("[拼履] {message}");
  #[cfg(target_os = "macos")]
  {
    let escaped = message.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
      r#"display alert "拼履无法启动" message "{escaped}" as critical buttons {{"好"}}"#
    );
    let _ = Command::new("osascript").arg("-e").arg(script).status();
  }
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let safe = message
      .replace('\r', " ")
      .replace('\n', " ")
      .replace('\'', "''");
    let ps = format!(
      "Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.MessageBox]::Show('{safe}','拼履无法启动','OK','Error')"
    );
    let _ = Command::new("powershell")
      .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
      .creation_flags(CREATE_NO_WINDOW)
      .status();
  }
}

struct RuntimePaths {
  static_dir: PathBuf,
  templates_dir: PathBuf,
  /// True when running from a Tauri install bundle (resources), not monorepo.
  packaged: bool,
}

fn resolve_paths(app: &tauri::AppHandle) -> Result<RuntimePaths, String> {
  if let Ok(res) = app.path().resource_dir() {
    let templates_dir = res.join("templates");
    let static_dir = res.join("web-dist");
    if static_dir.join("index.html").is_file() && templates_dir.is_dir() {
      return Ok(RuntimePaths {
        static_dir,
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
    templates_dir: root.join("templates"),
    packaged: false,
  })
}

/// Dev-only: spawn Fastify via npm in the monorepo (requires Node on PATH).
fn spawn_node_dev_server(app: &tauri::AppHandle) -> Result<(Child, PathBuf), String> {
  let paths = resolve_paths(app)?;
  if paths.packaged {
    return Err(
      "RESUME_API=node 仅用于仓库开发对照；安装包始终使用进程内 Rust API，无需 Node。"
        .into(),
    );
  }

  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let db_path = data_dir.join("resume.db");

  let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
  let root = repo_root();
  let mut cmd = Command::new("npm");
  cmd
    .args(["run", "start", "-w", "@resume/server"])
    .current_dir(&root);
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    cmd.creation_flags(0x08000000);
  }

  let log_path = data_dir.join("server.log");
  let log_file = OpenOptions::new()
    .create(true)
    .append(true)
    .open(&log_path)
    .ok();

  cmd
    .env("RESUME_DB_PATH", &db_path)
    .env("RESUME_STATIC_DIR", &paths.static_dir)
    .env("RESUME_TEMPLATES_DIR", &paths.templates_dir)
    .env("HOST", "127.0.0.1")
    .env("PORT", &port)
    .stdout(Stdio::null())
    .stderr(match log_file {
      Some(f) => Stdio::from(f),
      None => Stdio::null(),
    });

  let child = cmd
    .spawn()
    .map_err(|e| format!("无法启动 Node API（需本机 npm）：{e}"))?;
  Ok((child, data_dir))
}

/// Start in-process Rust HTTP on the host/port the WebView expects.
fn start_rust_api(app: &tauri::AppHandle) -> Result<PathBuf, String> {
  let paths = resolve_paths(app)?;
  let data_dir = app
    .path()
    .app_data_dir()
    .map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
  let db_path = data_dir.join("resume.db");

  let (conn, _photos) = core::ensure_db(&db_path)?;
  let state = core::AppState {
    store: Arc::new(core::Store::new(conn, db_path)),
    templates_dir: paths.templates_dir.clone(),
  };
  let static_dir = Some(paths.static_dir.clone());
  let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
  let port: u16 = std::env::var("PORT")
    .ok()
    .and_then(|p| p.parse().ok())
    .unwrap_or(8787);

  std::thread::Builder::new()
    .name("pinlu-rust-api".into())
    .spawn(move || {
      let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");
      if let Err(e) = rt.block_on(core::serve(state, static_dir, &host, port)) {
        eprintln!("[拼履] Rust API stopped: {e}");
      }
    })
    .map_err(|e| format!("spawn Rust API thread: {e}"))?;

  Ok(data_dir)
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

/// Native save-as for exported DOCX.
///
/// WKWebView exposes `showSaveFilePicker` but rejects instantly with `AbortError`
/// (no panel). WebView2 may abort or lack FS Access after navigating to
/// `http://127.0.0.1`. This command shows a real OS save panel and writes bytes.
///
/// Uses `AsyncFileDialog` + parent window so the panel is modal to the app on
/// Windows (sync `FileDialog` from a worker thread often fails / hides behind).
#[tauri::command]
async fn save_docx(
  window: tauri::WebviewWindow,
  suggested_name: String,
  data_base64: String,
) -> Result<Option<String>, String> {
  let safe = sanitize_save_name(&suggested_name);
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(data_base64.trim())
    .map_err(|e| format!("invalid DOCX payload: {e}"))?;
  if bytes.is_empty() {
    return Err("empty DOCX payload".into());
  }

  let file = rfd::AsyncFileDialog::new()
    .set_file_name(&safe)
    .add_filter("Word 文档", &["docx"])
    .set_parent(&window)
    .save_file()
    .await;

  match file {
    None => Ok(None),
    Some(handle) => {
      let path = handle.path().to_path_buf();
      // Ensure .docx extension if the user cleared the filter extension on Win.
      let path = ensure_docx_path(path);
      std::fs::write(&path, &bytes).map_err(|e| format!("写入失败: {e}"))?;
      let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or(safe);
      Ok(Some(name))
    }
  }
}

pub(crate) fn sanitize_save_name(suggested: &str) -> String {
  let cleaned: String = suggested
    .chars()
    .map(|c| match c {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
      _ => c,
    })
    .collect();
  let trimmed = cleaned.trim();
  let base = if trimmed.is_empty() {
    "resume.docx"
  } else {
    trimmed
  };
  if base.to_ascii_lowercase().ends_with(".docx") {
    base.into()
  } else {
    format!("{base}.docx")
  }
}

fn ensure_docx_path(path: PathBuf) -> PathBuf {
  let name = path
    .file_name()
    .map(|n| n.to_string_lossy().into_owned())
    .unwrap_or_else(|| "resume.docx".into());
  if name.to_ascii_lowercase().ends_with(".docx") {
    path
  } else {
    path.with_file_name(format!("{name}.docx"))
  }
}

#[cfg(test)]
mod save_docx_tests {
  use super::{ensure_docx_path, sanitize_save_name};
  use std::path::PathBuf;

  #[test]
  fn sanitize_strips_windows_forbidden_chars() {
    assert_eq!(sanitize_save_name("a/b:c?.docx"), "a_b_c_.docx");
    assert_eq!(sanitize_save_name("我的简历"), "我的简历.docx");
    assert_eq!(sanitize_save_name("   "), "resume.docx");
  }

  #[test]
  fn ensure_docx_appends_extension() {
    let p = ensure_docx_path(PathBuf::from(r"C:\Users\x\简历"));
    assert!(p
      .file_name()
      .unwrap()
      .to_string_lossy()
      .ends_with(".docx"));
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .manage(ServerChild(Mutex::new(None)))
    .invoke_handler(tauri::generate_handler![save_docx])
    .setup(|app| {
      let port = std::env::var("PORT").unwrap_or_else(|_| "8787".into());
      let backend = api_backend();
      // Never panic here: macOS ObjC didFinishLaunching cannot unwind → SIGABRT.
      let data_dir = match backend {
        ApiBackend::Rust => match start_rust_api(app.handle()) {
          Ok(dir) => dir,
          Err(e) => {
            show_startup_error(&e);
            app.handle().exit(1);
            return Ok(());
          }
        },
        ApiBackend::Node => {
          let (child, data_dir) = match spawn_node_dev_server(app.handle()) {
            Ok(v) => v,
            Err(e) => {
              show_startup_error(&e);
              app.handle().exit(1);
              return Ok(());
            }
          };
          {
            let state = app.state::<ServerChild>();
            *state.0.lock().unwrap() = Some(child);
          }
          data_dir
        }
      };

      if let Err(e) = wait_for_health(&port) {
        let hint = match backend {
          ApiBackend::Rust => format!(
            "{e}\n\n进程内 Rust API 启动失败。{}",
            app_log_hint(&data_dir)
          ),
          ApiBackend::Node => format!(
            "{e}\n\nRESUME_API=node 启动失败（需本机 Node 22+ / npm）。{}",
            app_log_hint(&data_dir)
          ),
        };
        show_startup_error(&hint);
        app.handle().exit(1);
        return Ok(());
      }

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
