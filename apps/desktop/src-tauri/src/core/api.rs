//! Embedded localhost HTTP — Phase 2 CRUD + photo; export → 501 (Phase 3).

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use base64::Engine;
use serde::Deserialize;
use serde_json::Value;
use tower_http::services::{ServeDir, ServeFile};

use crate::core::domain::{
  category_allowed_in_section, is_category, is_placeable_section, is_section_id,
  snapshot_from_module,
};
use crate::core::error::ApiError;
use crate::core::models::{HealthResponse, MetaResponse, StorageMeta};
use crate::core::store::{ModuleInput, ProfileInput, Store};
use crate::core::templates::{is_registered_template_id, list_template_meta, DEFAULT_TEMPLATE_ID};

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileBody {
  name: Option<String>,
  gender: Option<String>,
  phone: Option<String>,
  email: Option<String>,
  wechat: Option<String>,
  qq: Option<String>,
  location: Option<String>,
  summary: Option<String>,
  statement: Option<String>,
  education: Option<Value>,
  skills: Option<Value>,
  tags: Option<Value>,
  notes: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModuleBody {
  category: Option<String>,
  title: Option<String>,
  subtitle: Option<String>,
  project_type: Option<String>,
  time_range: Option<String>,
  body: Option<String>,
  tags: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResumeCreateBody {
  title: Option<String>,
  template_id: Option<String>,
  profile_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResumePatchBody {
  title: Option<String>,
  profile_id: Option<Option<String>>,
  template_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlacementBody {
  section: Option<String>,
  module_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReorderBody {
  section: Option<String>,
  ordered_placement_ids: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PhotoBody {
  data_base64: Option<String>,
  mime: Option<String>,
}

const EXPORT_PHASE3_MSG: &str =
  "DOCX export is Phase 3; set RESUME_API=node (default) for export, or wait for Rust exporter";

pub fn router(state: AppState, static_dir: Option<PathBuf>) -> Router {
  let api = Router::new()
    .route("/health", get(health))
    .route("/api/meta", get(meta))
    .route("/api/templates", get(templates))
    .route("/api/profiles", get(list_profiles).post(create_profile))
    .route(
      "/api/profiles/{id}",
      get(get_profile).put(update_profile).delete(delete_profile),
    )
    .route(
      "/api/profiles/{id}/photo",
      get(get_profile_photo)
        .put(put_profile_photo)
        .delete(delete_profile_photo),
    )
    .route("/api/modules", get(list_modules).post(create_module))
    .route(
      "/api/modules/{id}",
      get(get_module).put(update_module).delete(delete_module),
    )
    .route("/api/resumes", get(list_resumes).post(create_resume))
    .route("/api/resumes/{id}", get(get_resume).patch(patch_resume))
    .route("/api/resumes/{id}/placements", post(add_placement))
    .route(
      "/api/resumes/{id}/placements/reorder",
      patch(reorder_placements),
    )
    .route(
      "/api/resumes/{id}/placements/{placement_id}",
      delete(delete_placement),
    )
    .route("/api/resumes/{id}/export", post(export_not_implemented))
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

async fn create_profile(
  State(state): State<AppState>,
  Json(body): Json<ProfileBody>,
) -> Result<impl IntoResponse, ApiError> {
  let created = state.store.create_profile(profile_input(&body)?)?;
  Ok((StatusCode::CREATED, Json(created)))
}

async fn update_profile(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<ProfileBody>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.update_profile(&id, profile_input(&body)?)?))
}

async fn delete_profile(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  state.store.delete_profile(&id)?;
  Ok(StatusCode::NO_CONTENT)
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

async fn put_profile_photo(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<PhotoBody>,
) -> Result<impl IntoResponse, ApiError> {
  let raw_b64 = body
    .data_base64
    .as_deref()
    .ok_or_else(|| ApiError::bad_request("dataBase64 required"))?;
  let mime = body.mime.as_deref().unwrap_or("image/jpeg");
  let ext = if mime.contains("png") {
    "png"
  } else if mime.contains("webp") {
    "webp"
  } else {
    "jpg"
  };
  let stripped = raw_b64
    .find(";base64,")
    .map(|idx| &raw_b64[idx + ";base64,".len()..])
    .or_else(|| {
      raw_b64
        .strip_prefix("data:")
        .and_then(|rest| rest.find(',').map(|i| &rest[i + 1..]))
    })
    .unwrap_or(raw_b64);
  let bytes = base64::engine::general_purpose::STANDARD
    .decode(stripped.trim())
    .map_err(|_| ApiError::bad_request("invalid base64 photo"))?;
  if bytes.is_empty() {
    return Err(ApiError::bad_request("empty photo"));
  }
  if bytes.len() > 5 * 1024 * 1024 {
    return Err(ApiError::bad_request("photo too large (max 5MB)"));
  }
  Ok(Json(state.store.save_profile_photo(&id, &bytes, ext)?))
}

async fn delete_profile_photo(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  Ok(Json(state.store.clear_profile_photo(&id)?))
}

async fn list_modules(
  State(state): State<AppState>,
  Query(q): Query<ModuleQuery>,
) -> Result<impl IntoResponse, ApiError> {
  if let Some(ref cat) = q.category {
    if !is_category(cat) {
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

async fn create_module(
  State(state): State<AppState>,
  Json(body): Json<ModuleBody>,
) -> Result<impl IntoResponse, ApiError> {
  let cat = body
    .category
    .as_deref()
    .filter(|c| is_category(c))
    .ok_or_else(|| ApiError::bad_request("valid category is required"))?;
  let created = state.store.create_module(module_input(cat, &body))?;
  Ok((StatusCode::CREATED, Json(created)))
}

async fn update_module(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<ModuleBody>,
) -> Result<impl IntoResponse, ApiError> {
  let cat = body
    .category
    .as_deref()
    .filter(|c| is_category(c))
    .ok_or_else(|| ApiError::bad_request("valid category is required"))?;
  Ok(Json(
    state.store.update_module(&id, module_input(cat, &body))?,
  ))
}

async fn delete_module(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  state.store.delete_module(&id)?;
  Ok(StatusCode::NO_CONTENT)
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

async fn create_resume(
  State(state): State<AppState>,
  Json(body): Json<ResumeCreateBody>,
) -> Result<impl IntoResponse, ApiError> {
  if let Some(ref tid) = body.template_id {
    if !is_registered_template_id(&state.templates_dir, tid) {
      return Err(ApiError::bad_request(format!("unknown template: {tid}")));
    }
  }
  let templates_dir = state.templates_dir.clone();
  let created = state.store.create_resume(
    body.title.as_deref(),
    body.template_id.as_deref(),
    body.profile_id.as_deref(),
    |tid| is_registered_template_id(&templates_dir, tid),
  )?;
  Ok((StatusCode::CREATED, Json(created)))
}

async fn patch_resume(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<ResumePatchBody>,
) -> Result<impl IntoResponse, ApiError> {
  let templates_dir = state.templates_dir.clone();
  let profile_id = body
    .profile_id
    .as_ref()
    .map(|opt| opt.as_deref());
  Ok(Json(state.store.patch_resume(
    &id,
    body.title.as_deref(),
    profile_id,
    body.template_id.as_deref(),
    |tid| is_registered_template_id(&templates_dir, tid),
  )?))
}

async fn add_placement(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<PlacementBody>,
) -> Result<impl IntoResponse, ApiError> {
  let section = body
    .section
    .as_deref()
    .filter(|s| is_section_id(s))
    .ok_or_else(|| ApiError::bad_request("valid section is required"))?;
  if !is_placeable_section(section) {
    return Err(ApiError::bad_request(format!(
      "section {section} does not accept placements"
    )));
  }
  let module_id = body
    .module_id
    .as_deref()
    .filter(|s| !s.is_empty())
    .ok_or_else(|| ApiError::bad_request("moduleId is required"))?;
  let mod_ = state.store.get_module(module_id)?;
  if !category_allowed_in_section(&mod_.category, section) {
    return Err(ApiError::bad_request(format!(
      "category {} cannot be placed in section {section}",
      mod_.category
    )));
  }
  let snapshot = snapshot_from_module(&mod_);
  let placement = state.store.add_placement(&id, section, snapshot)?;
  Ok((StatusCode::CREATED, Json(placement)))
}

async fn reorder_placements(
  State(state): State<AppState>,
  Path(id): Path<String>,
  Json(body): Json<ReorderBody>,
) -> Result<impl IntoResponse, ApiError> {
  let section = body
    .section
    .as_deref()
    .filter(|s| is_section_id(s))
    .ok_or_else(|| ApiError::bad_request("valid section is required"))?;
  let ordered = body
    .ordered_placement_ids
    .as_ref()
    .ok_or_else(|| ApiError::bad_request("orderedPlacementIds must be an array"))?;
  Ok(Json(
    state
      .store
      .reorder_placements(&id, section, ordered)?,
  ))
}

async fn delete_placement(
  State(state): State<AppState>,
  Path((id, placement_id)): Path<(String, String)>,
) -> Result<impl IntoResponse, ApiError> {
  state.store.delete_placement(&id, &placement_id)?;
  Ok(StatusCode::NO_CONTENT)
}

async fn export_not_implemented() -> impl IntoResponse {
  ApiError::NotImplemented(EXPORT_PHASE3_MSG.into())
}

fn profile_input<'a>(body: &'a ProfileBody) -> Result<ProfileInput<'a>, ApiError> {
  Ok(ProfileInput {
    name: body.name.as_deref().unwrap_or(""),
    gender: body.gender.as_deref().unwrap_or(""),
    phone: body.phone.as_deref().unwrap_or(""),
    email: body.email.as_deref().unwrap_or(""),
    wechat: body.wechat.as_deref().unwrap_or(""),
    qq: body.qq.as_deref(),
    location: body.location.as_deref(),
    summary: body.summary.as_deref(),
    statement: body.statement.as_deref(),
    education: body.education.as_ref(),
    skills: body.skills.as_ref(),
    tags: body.tags.as_ref(),
    notes: body.notes.as_deref(),
  })
}

fn module_input<'a>(category: &'a str, body: &'a ModuleBody) -> ModuleInput<'a> {
  ModuleInput {
    category,
    title: body.title.as_deref().unwrap_or(""),
    subtitle: body.subtitle.as_deref(),
    project_type: body.project_type.as_deref(),
    time_range: body.time_range.as_deref(),
    body: body.body.as_deref().unwrap_or(""),
    tags: body.tags.as_ref(),
  }
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
  async fn health_ok() {
    let (state, path) = test_state();
    let app = router(state, None);
    let res = app
      .oneshot(Request::builder().uri("/health").body(Body::empty()).unwrap())
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let _ = std::fs::remove_file(&path);
  }

  #[tokio::test]
  async fn crud_profile_module_placement_snapshot() {
    let (state, path) = test_state();
    let app = router(state, None);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles")
          .header("content-type", "application/json")
          .body(Body::from(
            r#"{"name":"张三","gender":"男","phone":"138","email":"a@b.c","wechat":"wx"}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let profile_id = profile["id"].as_str().unwrap().to_string();
    assert_eq!(profile["name"], "张三");
    assert_eq!(profile["hasPhoto"], false);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/modules")
          .header("content-type", "application/json")
          .body(Body::from(
            r#"{"category":"project","title":"Demo","body":"v1","tags":["t1"]}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let module: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let module_id = module["id"].as_str().unwrap().to_string();

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/resumes")
          .header("content-type", "application/json")
          .body(Body::from(format!(
            r#"{{"title":"R1","profileId":"{profile_id}"}}"#
          )))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let resume: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let resume_id = resume["id"].as_str().unwrap().to_string();

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri(format!("/api/resumes/{resume_id}/placements"))
          .header("content-type", "application/json")
          .body(Body::from(format!(
            r#"{{"section":"projects","moduleId":"{module_id}"}}"#
          )))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let placement: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(placement["snapshot"]["title"], "Demo");
    assert_eq!(placement["snapshot"]["body"], "v1");

    // Mutate library module — snapshot must stay frozen (snapshot-on-drop).
    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("PUT")
          .uri(format!("/api/modules/{module_id}"))
          .header("content-type", "application/json")
          .body(Body::from(
            r#"{"category":"project","title":"Changed","body":"v2","tags":["t1"]}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .uri(format!("/api/resumes/{resume_id}"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let resume: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(resume["placements"][0]["snapshot"]["title"], "Demo");
    assert_eq!(resume["placements"][0]["snapshot"]["body"], "v1");

    // Delete module must not remove placement.
    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("DELETE")
          .uri(format!("/api/modules/{module_id}"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::NO_CONTENT);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .uri(format!("/api/resumes/{resume_id}"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let resume: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(resume["placements"].as_array().unwrap().len(), 1);

    // Export still Phase 3.
    let res = app
      .oneshot(
        Request::builder()
          .method("POST")
          .uri(format!("/api/resumes/{resume_id}/export"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_IMPLEMENTED);

    let _ = std::fs::remove_file(&path);
  }

  #[tokio::test]
  async fn photo_upload_roundtrip() {
    let (state, path) = test_state();
    let app = router(state, None);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles")
          .header("content-type", "application/json")
          .body(Body::from(
            r#"{"name":"P","gender":"女","phone":"1","email":"e@e.com","wechat":"w"}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let id = profile["id"].as_str().unwrap();

    // 1x1 PNG
    let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("PUT")
          .uri(format!("/api/profiles/{id}/photo"))
          .header("content-type", "application/json")
          .body(Body::from(format!(
            r#"{{"dataBase64":"{png_b64}","mime":"image/png"}}"#
          )))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(profile["hasPhoto"], true);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .uri(format!("/api/profiles/{id}/photo"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert_eq!(
      res.headers().get("content-type").unwrap(),
      "image/png"
    );

    let res = app
      .oneshot(
        Request::builder()
          .method("DELETE")
          .uri(format!("/api/profiles/{id}/photo"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(profile["hasPhoto"], false);

    let photos = path.parent().unwrap().join("photos");
    let _ = std::fs::remove_dir_all(&photos);
    let _ = std::fs::remove_file(&path);
  }

  #[tokio::test]
  async fn rejects_invalid_profile() {
    let (state, path) = test_state();
    let app = router(state, None);
    let res = app
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles")
          .header("content-type", "application/json")
          .body(Body::from(r#"{"name":"","gender":"男"}"#))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let _ = std::fs::remove_file(&path);
  }
}
