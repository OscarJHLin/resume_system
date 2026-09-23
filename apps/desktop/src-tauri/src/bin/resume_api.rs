//! Standalone Rust API for Phase 1–3 对照 (no Tauri).
//!
//! CRUD + photo + DOCX export (`POST /api/resumes/:id/export`).
//!
//! ```bash
//! # from apps/desktop/src-tauri
//! RESUME_DB_PATH=../../../data/resume.db \
//! RESUME_TEMPLATES_DIR=../../../templates \
//! PORT=8788 \
//! cargo run --bin resume_api
//! ```

use std::path::PathBuf;
use std::sync::Arc;

use app_lib::core::{ensure_db, list_template_meta, serve, AppState, Store};

fn repo_templates() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../templates")
}

fn default_db() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data/resume.db")
}

#[tokio::main]
async fn main() {
  let _ = env_logger_init();

  let db_path = std::env::var("RESUME_DB_PATH")
    .map(PathBuf::from)
    .unwrap_or_else(|_| default_db());
  let templates_dir = std::env::var("RESUME_TEMPLATES_DIR")
    .map(PathBuf::from)
    .unwrap_or_else(|_| repo_templates());
  let static_dir = std::env::var("RESUME_STATIC_DIR")
    .ok()
    .map(PathBuf::from)
    .filter(|p| p.join("index.html").is_file());
  let host = std::env::var("HOST").unwrap_or_else(|_| "127.0.0.1".into());
  let port: u16 = std::env::var("PORT")
    .ok()
    .and_then(|p| p.parse().ok())
    .unwrap_or(8788);

  let (conn, photos) = ensure_db(&db_path).unwrap_or_else(|e| {
    eprintln!("failed to open db {}: {e}", db_path.display());
    std::process::exit(1);
  });
  let templates = list_template_meta(&templates_dir);
  eprintln!(
    "resume_api: db={} photos={} templates={} ({}) static={:?}",
    db_path.display(),
    photos.display(),
    templates_dir.display(),
    templates.len(),
    static_dir.as_ref().map(|p| p.display().to_string())
  );

  let state = AppState {
    store: Arc::new(Store::new(conn, db_path)),
    templates_dir,
  };

  if let Err(e) = serve(state, static_dir, &host, port).await {
    eprintln!("{e}");
    std::process::exit(1);
  }
}

fn env_logger_init() -> Result<(), ()> {
  // Keep deps light — log to stderr via eprintln in serve; optional RUST_LOG unused.
  Ok(())
}
