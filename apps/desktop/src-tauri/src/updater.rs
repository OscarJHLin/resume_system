//! In-app updates (ADR-0005): the UI asks, the user confirms, then we install.
//!
//! - `check_update` → [`UpdateInfo`] (also caches the pending [`Update`])
//! - `install_update` → download + verify + install, emitting
//!   `update://progress` `{ downloaded, total }`, then restart
//! - background loop: check on startup and every [`CHECK_INTERVAL`], emit
//!   `update://available` with [`UpdateInfo`] when a newer release exists
//!
//! Windows: NSIS runs in `passive` mode and the plugin exits the process
//! itself; the installer relaunches the app. macOS: `.app.tar.gz` replaces the
//! bundle, then we restart. App Data (`resume.db`, `photos/`) is never touched.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

pub const EVENT_AVAILABLE: &str = "update://available";
pub const EVENT_PROGRESS: &str = "update://progress";
const STARTUP_DELAY: Duration = Duration::from_secs(5);
const CHECK_INTERVAL: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Default)]
pub struct PendingUpdate {
  update: Mutex<Option<Update>>,
  installing: Mutex<bool>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
  pub available: bool,
  pub current_version: String,
  pub version: Option<String>,
  pub notes: Option<String>,
  pub date: Option<String>,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct Progress {
  pub downloaded: u64,
  pub total: Option<u64>,
}

fn info_from(current_version: String, update: Option<&Update>) -> UpdateInfo {
  match update {
    None => UpdateInfo {
      available: false,
      current_version,
      version: None,
      notes: None,
      date: None,
    },
    Some(u) => UpdateInfo {
      available: true,
      current_version,
      version: Some(u.version.clone()),
      notes: u.body.clone().filter(|b| !b.trim().is_empty()),
      date: u
        .raw_json
        .get("pub_date")
        .and_then(|v| v.as_str())
        .map(str::to_owned)
        .or_else(|| u.date.map(|d| d.to_string())),
    },
  }
}

async fn fetch(app: &AppHandle) -> Result<UpdateInfo, String> {
  let current = app.package_info().version.to_string();
  let updater = app.updater().map_err(|e| e.to_string())?;
  let update = updater.check().await.map_err(|e| e.to_string())?;
  let info = info_from(current, update.as_ref());
  let state = app.state::<PendingUpdate>();
  *state.update.lock().unwrap() = update;
  Ok(info)
}

#[tauri::command]
pub async fn check_update(app: AppHandle) -> Result<UpdateInfo, String> {
  fetch(&app).await
}

#[tauri::command]
pub async fn install_update(
  app: AppHandle,
  state: State<'_, PendingUpdate>,
) -> Result<(), String> {
  {
    let mut busy = state.installing.lock().unwrap();
    if *busy {
      return Err("更新已在进行中".into());
    }
    *busy = true;
  }
  let result = download_install(&app, &*state).await;
  *state.installing.lock().unwrap() = false;
  result?;
  app.restart();
}

async fn download_install(app: &AppHandle, state: &PendingUpdate) -> Result<(), String> {
  let cached = state.update.lock().unwrap().clone();
  let update = match cached {
    Some(u) => u,
    None => {
      fetch(app).await?;
      state
        .update
        .lock()
        .unwrap()
        .clone()
        .ok_or_else(|| "已是最新版本".to_string())?
    }
  };

  let mut downloaded: u64 = 0;
  let emitter = app.clone();
  update
    .download_and_install(
      |chunk, total| {
        downloaded += chunk as u64;
        let _ = emitter.emit(EVENT_PROGRESS, Progress { downloaded, total });
      },
      || {},
    )
    .await
    .map_err(|e| e.to_string())
}

/// Check on startup and periodically; notify the UI instead of installing.
pub fn spawn_background_checks(app: AppHandle) {
  tauri::async_runtime::spawn(async move {
    tokio::time::sleep(STARTUP_DELAY).await;
    loop {
      match fetch(&app).await {
        Ok(info) if info.available => {
          log::info!(
            "[拼履] update available {} → {:?}",
            info.current_version,
            info.version
          );
          let _ = app.emit(EVENT_AVAILABLE, info);
        }
        Ok(_) => log::info!("[拼履] updater: already latest"),
        Err(e) => log::info!("[拼履] updater: {e}"),
      }
      tokio::time::sleep(CHECK_INTERVAL).await;
    }
  });
}

#[cfg(test)]
mod tests {
  use super::info_from;

  #[test]
  fn no_update_reports_current_version_only() {
    let info = info_from("1.5.3".into(), None);
    assert!(!info.available);
    assert_eq!(info.current_version, "1.5.3");
    assert_eq!(info.version, None);
    let json = serde_json::to_value(&info).unwrap();
    assert_eq!(json["currentVersion"], "1.5.3");
    assert_eq!(json["available"], false);
  }
}
