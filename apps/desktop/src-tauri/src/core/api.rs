//! Embedded localhost HTTP — Phase 3 CRUD + photo + DOCX export.

use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::body::Body;
use axum::extract::{DefaultBodyLimit, Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{delete, get, patch, post};
use axum::{Json, Router};
use base64::Engine;
use serde::Deserialize;
use serde_json::Value;
use tower_http::services::{ServeDir, ServeFile};

/// 10 MiB: photo uploads send base64 JSON (5MB image ≈ 6.7MB payload + wrapper).
/// Axum's default is 2 MiB — that caused `length limit exceeded` on ID photos.
const MAX_REQUEST_BODY_BYTES: usize = 10 * 1024 * 1024;
const MAX_PHOTO_BYTES: usize = 5 * 1024 * 1024;
const PHOTO_TOO_LARGE_MSG: &str = "上传内容过大（照片请小于 5MB）";

use crate::core::domain::{
  category_allowed_in_section, is_category, is_placeable_section, is_section_id,
  snapshot_from_module,
};
use crate::core::error::ApiError;
use crate::core::export::{export_docx, sanitize_filename, ExportPhoto};
use crate::core::models::{HealthResponse, MetaResponse, StorageMeta};
use crate::core::render::{placeholder_profile, render_to_ir};
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
    .route("/api/profiles/{id}/copy", post(copy_profile))
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
    .route("/api/resumes/{id}/export", post(export_resume))
    .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_BYTES))
    .layer(middleware::from_fn(map_payload_too_large))
    .with_state(state);

  if let Some(dir) = static_dir {
    let index = dir.join("index.html");
    let serve = ServeDir::new(&dir).not_found_service(ServeFile::new(index));
    api.fallback_service(serve)
  } else {
    api
  }
}

/// Rewrite axum's English 413 body into the same Chinese JSON as Fastify.
async fn map_payload_too_large(req: axum::extract::Request, next: Next) -> Response {
  let res = next.run(req).await;
  if res.status() != StatusCode::PAYLOAD_TOO_LARGE {
    return res;
  }
  (
    StatusCode::PAYLOAD_TOO_LARGE,
    Json(serde_json::json!({
      "error": "PayloadTooLarge",
      "message": PHOTO_TOO_LARGE_MSG,
    })),
  )
    .into_response()
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
  log::info!("[拼履] Rust API listening on http://{addr}/");
  axum::serve(listener, app)
    .await
    .map_err(|e| format!("serve: {e}"))
}

async fn health() -> Json<HealthResponse> {
  Json(HealthResponse {
    ok: true,
    service: "resume-server",
    phase: "S5",
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

async fn copy_profile(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<impl IntoResponse, ApiError> {
  let created = state.store.copy_profile(&id)?;
  Ok((StatusCode::CREATED, Json(created)))
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
  if bytes.len() > MAX_PHOTO_BYTES {
    return Err(ApiError::bad_request(PHOTO_TOO_LARGE_MSG));
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

async fn export_resume(
  State(state): State<AppState>,
  Path(id): Path<String>,
) -> Result<Response, ApiError> {
  let resume = state.store.get_resume(&id)?;
  let profile = if resume.profile_id.trim().is_empty() {
    placeholder_profile()
  } else {
    state.store.get_profile(&resume.profile_id)?
  };
  let ir = render_to_ir(
    &state.templates_dir,
    &resume.template_id,
    &profile,
    &resume.placements,
    crate::core::domain::now_iso,
  )?;
  let photo = if resume.profile_id.trim().is_empty() {
    None
  } else {
    state
      .store
      .get_profile_photo(&resume.profile_id)?
      .map(|(buffer, mime, _)| ExportPhoto { buffer, mime })
  };
  let bytes = export_docx(&state.templates_dir, &ir, photo.as_ref())?;
  let filename = format!("{}.docx", sanitize_filename(&resume.title));
  let encoded = urlencoding_encode(&filename);
  let mut headers = HeaderMap::new();
  headers.insert(
    header::CONTENT_TYPE,
    HeaderValue::from_static(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
  );
  let disposition = format!("attachment; filename=\"resume.docx\"; filename*=UTF-8''{encoded}");
  headers.insert(
    header::CONTENT_DISPOSITION,
    HeaderValue::from_str(&disposition)
      .unwrap_or_else(|_| HeaderValue::from_static("attachment; filename=\"resume.docx\"")),
  );
  Ok((StatusCode::OK, headers, bytes).into_response())
}

/// Minimal RFC 3986 encode for Content-Disposition filename* (enough for CJK titles).
fn urlencoding_encode(s: &str) -> String {
  let mut out = String::new();
  for b in s.as_bytes() {
    match b {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
        out.push(*b as char);
      }
      _ => out.push_str(&format!("%{b:02X}")),
    }
  }
  out
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
  use std::sync::atomic::{AtomicU64, Ordering};
  use tower::ServiceExt;

  static API_SEQ: AtomicU64 = AtomicU64::new(0);

  fn cleanup_db(path: &std::path::Path) {
    if let Some(dir) = path.parent() {
      let _ = std::fs::remove_dir_all(dir);
    }
  }

  fn test_state() -> (AppState, PathBuf) {
    let nanos = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap()
      .as_nanos();
    let seq = API_SEQ.fetch_add(1, Ordering::Relaxed);
    let dir = std::env::temp_dir().join(format!("pinlu-api-{nanos}-{seq}"));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("resume.db");
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
    cleanup_db(&path);
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

    // Export DOCX (Phase 3).
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
    assert_eq!(res.status(), StatusCode::OK);
    let ct = res
      .headers()
      .get(header::CONTENT_TYPE)
      .and_then(|v| v.to_str().ok())
      .unwrap_or("");
    assert!(ct.contains("wordprocessingml") || ct.contains("octet-stream"));
    let body = to_bytes(res.into_body(), 2 * 1024 * 1024).await.unwrap();
    assert!(body.len() > 100);
    assert_eq!(&body[0..2], b"PK");

    cleanup_db(&path);
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
    cleanup_db(&path);
  }

  #[tokio::test]
  async fn photo_upload_accepts_payload_over_axum_default_2mb() {
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
            r#"{"name":"大图","gender":"女","phone":"1","email":"big@e.com","wechat":"w"}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let id = profile["id"].as_str().unwrap();

    // ~1.6MB binary → ~2.1MB base64 JSON (exceeds axum DefaultBodyLimit 2MB).
    let mut raw = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    raw.resize(1_600_008, 0);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);
    let payload = format!(r#"{{"dataBase64":"{b64}","mime":"image/png"}}"#);
    assert!(
      payload.len() > 2 * 1024 * 1024,
      "test payload must exceed axum's old 2MB default"
    );

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("PUT")
          .uri(format!("/api/profiles/{id}/photo"))
          .header("content-type", "application/json")
          .body(Body::from(payload))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(profile["hasPhoto"], true);
    cleanup_db(&path);
  }

  #[tokio::test]
  async fn photo_upload_rejects_oversize_with_chinese_message() {
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
            r#"{"name":"超限","gender":"男","phone":"1","email":"x@e.com","wechat":"w"}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let id = profile["id"].as_str().unwrap();

    // Decoded > 5MB but request body still under 10MB limit.
    let mut raw = vec![0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    raw.resize(5 * 1024 * 1024 + 8 + 64, 0);
    let b64 = base64::engine::general_purpose::STANDARD.encode(&raw);
    let payload = format!(r#"{{"dataBase64":"{b64}","mime":"image/png"}}"#);
    assert!(payload.len() < MAX_REQUEST_BODY_BYTES);

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("PUT")
          .uri(format!("/api/profiles/{id}/photo"))
          .header("content-type", "application/json")
          .body(Body::from(payload))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let err: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(err["message"], PHOTO_TOO_LARGE_MSG);

    // Body over HTTP limit → 413 with the same Chinese message.
    let huge = "x".repeat(MAX_REQUEST_BODY_BYTES + 1024);
    let res = app
      .oneshot(
        Request::builder()
          .method("PUT")
          .uri(format!("/api/profiles/{id}/photo"))
          .header("content-type", "application/json")
          .body(Body::from(format!(
            r#"{{"dataBase64":"{huge}","mime":"image/png"}}"#
          )))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::PAYLOAD_TOO_LARGE);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let err: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(err["error"], "PayloadTooLarge");
    assert_eq!(err["message"], PHOTO_TOO_LARGE_MSG);
    cleanup_db(&path);
  }

  #[tokio::test]
  async fn create_profile_then_photo_save_flow() {
    let (state, path) = test_state();
    let app = router(state, None);

    // Mirrors UI: create card fields, then PUT photo in the same save sequence.
    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles")
          .header("content-type", "application/json")
          .body(Body::from(
            r#"{"name":"草稿照","gender":"女","phone":"139","email":"d@e.com","wechat":"wx"}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let id = profile["id"].as_str().unwrap().to_string();
    assert_eq!(profile["hasPhoto"], false);

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
    let with_photo: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(with_photo["hasPhoto"], true);
    assert_eq!(with_photo["id"], id);

    let res = app
      .oneshot(
        Request::builder()
          .uri(format!("/api/profiles/{id}/photo"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    cleanup_db(&path);
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
    cleanup_db(&path);
  }

  #[tokio::test]
  async fn copy_profile_endpoint() {
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
            r#"{"name":"源","gender":"女","phone":"1","email":"e@e.com","wechat":"w","summary":"岗","tags":["t"]}"#,
          ))
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let profile: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let id = profile["id"].as_str().unwrap().to_string();

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

    let res = app
      .clone()
      .oneshot(
        Request::builder()
          .method("POST")
          .uri(format!("/api/profiles/{id}/copy"))
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);
    let body = to_bytes(res.into_body(), 64 * 1024).await.unwrap();
    let copy: serde_json::Value = serde_json::from_slice(&body).unwrap();
    assert_ne!(copy["id"].as_str().unwrap(), id);
    assert_eq!(copy["name"], "源（副本）");
    assert_eq!(copy["summary"], "岗");
    assert_eq!(copy["hasPhoto"], true);

    let res = app
      .oneshot(
        Request::builder()
          .method("POST")
          .uri("/api/profiles/missing-id/copy")
          .body(Body::empty())
          .unwrap(),
      )
      .await
      .unwrap();
    assert_eq!(res.status(), StatusCode::NOT_FOUND);
    cleanup_db(&path);
  }
}
