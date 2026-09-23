//! Embedded localhost HTTP — Phase 1 read GETs + static UI; writes → 501.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use tower_http::services::{ServeDir, ServeFile};

use crate::core::error::ApiError;
use crate::core::models::{HealthResponse, MetaResponse, StorageMeta};
use crate::core::store::Store;
use crate::core::templates::{list_template_meta, DEFAULT_TEMPLATE_ID};

#[derive(Clone)]
pub struct AppState {
  pub store: Arc<Store>,
  pub templates_dir: PathBuf,
}

#[derive(Debug, Deserialize)]
pub struct ProfileQuery {
  pub q: Option<String>,
  pub tag: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ModuleQuery {
  pub category: Option<String>,
  pub tag: Option<String>,
  pub q: Option<String>,
}

const PHASE1_WRITE_MSG: &str =
  "Plan C Phase 1 is read-only; set RESUME_API=node (default) for writes";

const VALID_CATEGORIES: &[&str] = &["skill", "project", "internship", "award"];

pub fn router(state: AppState, static_dir: Option<PathBuf>) -> Router {
  let api = Router::new()
    .route("/health", get(health))
    .route("/api/meta", get(meta))
    .route("/api/templates", get(templates))
    .route("/api/profiles", get(list_profiles).post(phase1_write))
    .route(
      "/api/profiles/{id}",
      get(get_profile)
        .put(phase1_write)
        .delete(phase1_write),
    )
    .route(
      "/api/profiles/{id}/photo",
      get(get_profile_photo)
        .put(phase1_write)
        .delete(phase1_write),
    )
    .route("/api/modules", get(list_modules).post(phase1_write))
    .route(
      "/api/modules/{id}",
      get(get_module).put(phase1_write).delete(phase1_write),
    )
    .route("/api/resumes", get(list_resumes).post(phase1_write))
    .route(
      "/api/resumes/{id}",
      get(get_resume).patch(phase1_write),
    )
    .route(
      "/api/resumes/{id}/placements",
      post(phase1_write),
    )
    .route(
      "/api/resumes/{id}/placements/reorder",
      axum::routing::patch(phase1_write),
    )
    .route(
      "/api/resumes/{id}/placements/{placement_id}",
      axum::routing::delete(phase1_write),
    )
    .route("/api/resumes/{id}/export", post(phase1_write))
    .with_state(state);

  if let Some(dir) = static_dir {
    let index = dir.join("index.html");
    let serve = ServeDir::new(&dir).not_found_service(ServeFile::new(index));
    api.fallback_service(serve)
  } else {
    api
  }
}

/// Bind and serve until process exit. Call from a dedicated thread / tokio runtime.
pub async fn serve(
  state: AppState,
  static_dir: Option<PathBuf>,
  host: &str,
  port: u16,
) -> Result<(), String> {
  let app = router(state, static_dir);
  let addr: SocketAddr = format!("{host}:{port}")
    .parse()
    .map_err(|e| format!("bad address: {e}"))?;
  let listener = tokio::net::TcpListener::bind(addr)
    .await
    .map_err(|e| format!("bind {addr}: {e}"))?;
  log::info!("[拼履] Rust API listening on http://{addr}/ (RESUME_API=rust)");
  axum::serve(listener, app)
    .await
    .map_err(|e| format!("serve: {e}"))
}

async fn health() -> Json<HealthResponse> {
  Json(HealthResponse {
    ok: true,
    service: "resume-server",
    phase: "scaffold",
    persistence: "sqlite-file",
  })
}

async fn meta(State(state): State<AppState>) -> Json<MetaResponse> {
  let templates = list_template_meta(&state.templates_dir);
  Json(MetaResponse {
    template_id: DEFAULT_TEMPLATE_ID.into(),
    templates,
    phase: "S5",
    modules: vec![
      "profile-cards",
      "content-library",
      "resume-assembly",
      "template-engine",
      "export-docx",
    ],
    status: "ready",
    storage: StorageMeta {
      engine: "sqlite",
      auto_managed: true,
      path: state.store.db_path().display().to_string(),
    },
  })
}

async fn templates(State(state): State<AppState>) -> impl IntoResponse {
  Json(list_template_meta(&state.templates_dir))
}

async fn list_profiles(
  State(state): State<AppState>,
  Query(q): Query<ProfileQuery>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.list_profiles(q.q.as_deref(), q.tag.as_deref())?))
}

async fn get_profile(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.get_profile(&id)?))
}

async fn get_profile_photo(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<Response, ApiError> {
  match state.store.get_profile_photo(&id)? {
    None => Err(ApiError::not_found("No photo")),
    Some((bytes, mime, _name)) => {
      let mut headers = HeaderMap::new();
      headers.insert(header::CONTENT_TYPE, mime.parse().unwrap());
      headers.insert(header::CACHE_CONTROL, "no-cache".parse().unwrap());
      Ok((StatusCode::OK, headers, Body::from(bytes)).into_response())
    }
  }
}

async fn list_modules(
  State(state): State<AppState>,
  Query(q): Query<ModuleQuery>,
) -> Result<impl IntoResponse, ApiError> {
  if let Some(ref cat) = q.category {
    if !VALID_CATEGORIES.contains(&cat.as_str()) {
      return Err(ApiError::bad_request(format!("invalid category: {cat}")));
    }
  }
  Ok(Json(state.store.list_modules(
    q.category.as_deref(),
    q.tag.as_deref(),
    q.q.as_deref(),
  )?))
}

async fn get_module(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.get_module(&id)?))
}

async fn list_resumes(State(state): State<AppState>) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.list_resumes()?))
}

async fn get_resume(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.get_resume(&id)?))
}

async fn phase1_write() -> impl IntoResponse {
  ApiError::NotImplemented(PHASE1_WRITE_MSG.into())
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::core::db::open_database;
  use axum::body::to_bytes;
  use axum::http::Request;
  use tower::ServiceExt;

  fn test_state() -> (AppState, PathBuf) {
    let nanos = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap()
      .as_nanos();
    let path = std::env::temp_dir().join(format!("pinlu-api-{nanos}.db"));
    let _ = std::fs::remove_file(&path);
    let conn = open_database(&path).unwrap();
    conn.execute(
      "INSERT INTO profile (
        id, name, gender, phone, email, wechat, education_json, skills_json, tags_json,
        created_at, updated_at
      ) VALUES ('p1', 'Bob', '男', '1', 'b@e.com', 'w', '[]', '[]', '[]', 't', 't')",
      [],
    )
    .unwrap();
    let templates = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../templates");
    (
      AppState {
        store: Arc::new(Store::new(conn, path.clone())),
        templates_dir: templates,
      },
      path,
    )
  }

  #[tokio::test]
  async fn health_and_profiles_json() {
    let (state, path) = test_state();
    let app = router(state, None);
    let res = app
      .clone()
      .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 1024).await.unwrap();
    let v: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(v["ok"], true);
    assert_eq!(v["service"], "resume-server");

    let res = app
      .oneshot(
        Request::builder()
          .uri("/api/profiles")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let list: Vec<serde_json::Value> = serde_json::from_slice(&body).unwrap();
    assert_eq!(list.len(), 1);
    assert_eq!(list[0]["name"], "Bob");
    assert_eq!(list[0]["hasPhoto"], false);
    let _ = std::fs::remove_file(&path);
  }

  #[tokio::test]
  async fn writes_return_501() {
    let (state, path) = test_state();
    let app = router(state, None);
    let res = app
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles")
          .header("content-type", "application/json")
          .body(Body::from("{}"))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_IMPLEMENTED);
    let _ = std::fs::remove_file(&path);
  }
}
