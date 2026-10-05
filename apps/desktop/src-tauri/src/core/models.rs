//! JSON shapes aligned with `apps/server` / `@resume/domain` (camelCase).

use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
  pub id: String,
  pub name: String,
  /// Always present (may be empty string) — matches Node `rowToProfile`.
  pub gender: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub phone: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub email: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub wechat: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub qq: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub location: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub expected_salary: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub target_city: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub hobbies: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub statement: Option<String>,
  pub education: Value,
  pub skills: Value,
  pub tags: Value,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub notes: Option<String>,
  /// Always present — matches Node `rowToProfile`.
  pub has_photo: bool,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeCustomSection {
  pub id: String,
  pub title: String,
  pub sort_order: i64,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContentModule {
  pub id: String,
  pub category: String,
  pub title: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub subtitle: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub project_type: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub time_range: Option<String>,
  pub body: String,
  pub tags: Value,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeSummary {
  pub id: String,
  pub title: String,
  pub template_id: String,
  pub profile_id: String,
  pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct SectionPlacement {
  pub id: String,
  pub section: String,
  pub sort_order: i64,
  /// Keep stored snapshot JSON as-is for parity with Node.
  pub snapshot: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ResumeDocument {
  pub id: String,
  pub title: String,
  pub template_id: String,
  pub profile_id: String,
  pub placements: Vec<SectionPlacement>,
  pub custom_sections: Vec<ResumeCustomSection>,
  pub updated_at: String,
}
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TemplateMeta {
  pub id: String,
  pub label: String,
  pub description: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetaResponse {
  pub template_id: String,
  pub templates: Vec<TemplateMeta>,
  pub phase: &'static str,
  pub modules: Vec<&'static str>,
  pub status: &'static str,
  pub storage: StorageMeta,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageMeta {
  pub engine: &'static str,
  pub auto_managed: bool,
  pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
  pub ok: bool,
  pub service: &'static str,
  pub phase: &'static str,
  pub persistence: &'static str,
}
