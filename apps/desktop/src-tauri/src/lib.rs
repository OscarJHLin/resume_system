use std::fs::OpenOptions;
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

fn push_unique(out: &mut Vec<PathBuf>, path: PathBuf) {
  if path.is_file() && !out.iter().any(|p| p == &path) {
    out.push(path);
  }
}

fn collect_version_manager_nodes(home: &Path, out: &mut Vec<PathBuf>) {
  // nvm (unix)
  let nvm = home.join(".nvm/versions/node");
  if nvm.is_dir() {
    if let Ok(entries) = std::fs::read_dir(&nvm) {
      let mut versions: Vec<PathBuf> = entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
      versions.sort();
      for v in versions.into_iter().rev() {
        push_unique(out, v.join("bin/node"));
        break;
      }
    }
  }
  // fnm
  for fnm_root in [
    home.join(".fnm/node-versions"),
    home.join(".local/share/fnm/node-versions"),
  ] {
    if fnm_root.is_dir() {
      if let Ok(entries) = std::fs::read_dir(&fnm_root) {
        let mut versions: Vec<PathBuf> = entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
        versions.sort();
        for v in versions.into_iter().rev() {
          push_unique(out, v.join("installation/bin/node"));
          break;
        }
      }
    }
  }
  push_unique(out, home.join(".volta/bin/node"));
}

/// GUI launches often omit Node from PATH (macOS Finder / Windows Explorer).
fn find_node() -> Result<PathBuf, String> {
  if let Ok(p) = std::env::var("RESUME_NODE") {
    let pb = PathBuf::from(p);
    if pb.is_file() {
      return Ok(pb);
    }
  }

  let mut candidates: Vec<PathBuf> = Vec::new();
  let node_name = if cfg!(windows) { "node.exe" } else { "node" };

  let mut path_dirs: Vec<PathBuf> = Vec::new();

  #[cfg(target_os = "macos")]
  {
    for d in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"] {
      path_dirs.push(PathBuf::from(d));
    }
  }
  #[cfg(target_os = "linux")]
  {
    for d in ["/usr/local/bin", "/usr/bin", "/bin"] {
      path_dirs.push(PathBuf::from(d));
    }
  }
  #[cfg(windows)]
  {
    // Official installer, scoop, chocolatey, per-user installs.
    for key in ["ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA", "APPDATA"] {
      if let Ok(root) = std::env::var(key) {
        let root = PathBuf::from(root);
        path_dirs.push(root.join("nodejs"));
        path_dirs.push(root.join("Programs").join("nodejs"));
        path_dirs.push(root.join("fnm"));
      }
    }
    if let Ok(user) = std::env::var("USERPROFILE") {
      let home = PathBuf::from(user);
      path_dirs.push(home.join(r"scoop\apps\nodejs\current"));
      path_dirs.push(home.join(r"scoop\shims"));
      path_dirs.push(home.join(r"AppData\Roaming\nvm"));
      path_dirs.push(home.join(r".volta\bin"));
    }
  }

  if let Ok(path) = std::env::var("PATH") {
    for part in std::env::split_paths(&path) {
      if !path_dirs.iter().any(|d| d == &part) {
        path_dirs.push(part);
      }
    }
  }

  for dir in &path_dirs {
    push_unique(&mut candidates, dir.join(node_name));
  }

  #[cfg(target_os = "macos")]
  {
    for p in [
      "/opt/homebrew/bin/node",
      "/usr/local/bin/node",
      "/usr/bin/node",
    ] {
      push_unique(&mut candidates, PathBuf::from(p));
    }
  }

  #[cfg(windows)]
  {
    // Probe nvm-windows version folders under APPDATA\nvm
    if let Ok(appdata) = std::env::var("APPDATA") {
      let nvm = PathBuf::from(appdata).join("nvm");
      if nvm.is_dir() {
        if let Ok(entries) = std::fs::read_dir(&nvm) {
          let mut versions: Vec<PathBuf> = entries
            .filter_map(|e| e.ok().map(|e| e.path()))
            .filter(|p| p.is_dir())
            .collect();
          versions.sort();
          for v in versions.into_iter().rev() {
            push_unique(&mut candidates, v.join("node.exe"));
            break;
          }
        }
      }
    }
  }

  if let Some(home) = std::env::var_os("HOME")
    .or_else(|| std::env::var_os("USERPROFILE"))
    .map(PathBuf::from)
  {
    collect_version_manager_nodes(&home, &mut candidates);
  }

  // `which` / `where` with augmented PATH as last resort.
  let which = if cfg!(windows) { "where" } else { "which" };
  let mut which_cmd = Command::new(which);
  which_cmd.arg(if cfg!(windows) { "node.exe" } else { "node" });
  if let Ok(joined) = std::env::join_paths(&path_dirs) {
    which_cmd.env("PATH", joined);
  }
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    which_cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
  }
  if let Ok(out) = which_cmd.output() {
    if out.status.success() {
      if let Some(line) = String::from_utf8_lossy(&out.stdout).lines().next() {
        push_unique(&mut candidates, PathBuf::from(line.trim()));
      }
    }
  }

  if let Some(p) = candidates.into_iter().next() {
    return Ok(p);
  }

  Err(
    "未找到 Node.js（需要 22+）。请从 https://nodejs.org 安装 LTS，安装时勾选「Add to PATH」，然后重新打开拼履。也可设置环境变量 RESUME_NODE 指向 node 可执行文件。"
      .into(),
  )
}

fn app_log_hint(data_dir: &Path) -> String {
  #[cfg(target_os = "macos")]
  {
    let _ = data_dir;
    "日志：~/Library/Application Support/com.pinlu.desktop/server.log".into()
  }
  #[cfg(target_os = "windows")]
  {
    format!(
      "日志：{}\\server.log",
      data_dir.display()
    )
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

fn spawn_local_server(app: &tauri::AppHandle) -> Result<(Child, PathBuf), String> {
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
    let mut c = Command::new(&node);
    c.arg(&paths.server_entry);
    // Ensure node can resolve siblings if it shells out; keep install dir on PATH.
    if let Some(dir) = node.parent() {
      let mut dirs = vec![dir.to_path_buf()];
      if let Ok(path) = std::env::var("PATH") {
        for part in std::env::split_paths(&path) {
          dirs.push(part);
        }
      }
      if let Ok(joined) = std::env::join_paths(dirs) {
        c.env("PATH", joined);
      }
    }
    #[cfg(windows)]
    {
      use std::os::windows::process::CommandExt;
      c.creation_flags(0x08000000); // CREATE_NO_WINDOW — no console flash
    }
    c
  } else {
    let root = repo_root();
    let mut c = Command::new("npm");
    c.args(["run", "start", "-w", "@resume/server"])
      .current_dir(&root);
    #[cfg(windows)]
    {
      use std::os::windows::process::CommandExt;
      c.creation_flags(0x08000000);
    }
    c
  };

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

  let child = cmd.spawn().map_err(|e| format!("无法启动内置 API：{e}"))?;
  Ok((child, data_dir))
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
      // Never panic here: macOS ObjC didFinishLaunching cannot unwind → SIGABRT.
      // Windows: same — show a dialog instead of hard abort.
      let (child, data_dir) = match spawn_local_server(app.handle()) {
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
      if let Err(e) = wait_for_health(&port) {
        let hint = format!(
          "{e}\n\n若已安装 Node，请确认版本 ≥ 22。{}",
          app_log_hint(&data_dir)
        );
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
