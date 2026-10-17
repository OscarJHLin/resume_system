use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
  #[error("{0}")]
  NotFound(String),
  #[error("{0}")]
  BadRequest(String),
  #[error("{0}")]
  Internal(String),
  #[error("{0}")]
  NotImplemented(String),
}

#[derive(Serialize)]
struct ErrorBody {
  error: &'static str,
  message: String,
}

impl ApiError {
  pub fn not_found(msg: impl Into<String>) -> Self {
    Self::NotFound(msg.into())
  }

  pub fn bad_request(msg: impl Into<String>) -> Self {
    Self::BadRequest(msg.into())
  }
}

impl IntoResponse for ApiError {
  fn into_response(self) -> Response {
    let (status, code, message) = match &self {
      ApiError::NotFound(m) => (StatusCode::NOT_FOUND, "NotFound", m.clone()),
      ApiError::BadRequest(m) => (StatusCode::BAD_REQUEST, "BadRequest", m.clone()),
      ApiError::NotImplemented(m) => (StatusCode::NOT_IMPLEMENTED, "NotImplemented", m.clone()),
      ApiError::Internal(m) => (StatusCode::INTERNAL_SERVER_ERROR, "InternalError", m.clone()),
    };
    (status, Json(ErrorBody { error: code, message })).into_response()
  }
}
