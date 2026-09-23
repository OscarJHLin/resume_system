//! Domain helpers mirrored from `packages/domain` (validation, matrix, snapshot).

use chrono::{SecondsFormat, Utc};
use serde_json::{json, Map, Value};
use uuid::Uuid;

use crate::core::error::ApiError;
use crate::core::models::ContentModule;

pub const CATEGORIES: &[&str] = &["skill", "project", "internship", "award"];
pub const GENDERS: &[&str] = &["男", "女"];
pub const SECTION_IDS: &[&str] = &[
  "basic",
  "education",
  "skills",
  "projects",
  "internships",
  "awards",
];
pub const PLACEABLE_SECTIONS: &[&str] = &["projects", "internships", "awards"];

pub fn new_id() -> String {
  Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
  Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn is_category(value: &str) -> bool {
  CATEGORIES.contains(&value)
}

pub fn is_section_id(value: &str) -> bool {
  SECTION_IDS.contains(&value)
}

pub fn is_placeable_section(section: &str) -> bool {
  PLACEABLE_SECTIONS.contains(&section)
}

pub fn is_gender(value: &str) -> bool {
  GENDERS.contains(&value)
}

pub fn category_allowed_in_section(category: &str, section: &str) -> bool {
  match category {
    "project" => section == "projects",
    "internship" => section == "internships",
    "award" => section == "awards",
    _ => false,
  }
}

pub fn validate_profile_required(
  name: Option<&str>,
  gender: Option<&str>,
  email: Option<&str>,
  phone: Option<&str>,
  wechat: Option<&str>,
) -> Result<(), ApiError> {
  if name.map(str::trim).filter(|s| !s.is_empty()).is_none() {
    return Err(ApiError::bad_request("姓名为必填项"));
  }
  let g = gender.map(str::trim).unwrap_or("");
  if g.is_empty() || !is_gender(g) {
    return Err(ApiError::bad_request("性别为必填项（男/女）"));
  }
  if email.map(str::trim).filter(|s| !s.is_empty()).is_none() {
    return Err(ApiError::bad_request("邮箱为必填项"));
  }
  if phone.map(str::trim).filter(|s| !s.is_empty()).is_none() {
    return Err(ApiError::bad_request("手机号为必填项"));
  }
  if wechat.map(str::trim).filter(|s| !s.is_empty()).is_none() {
    return Err(ApiError::bad_request("微信号为必填项"));
  }
  Ok(())
}

pub fn education_time_range(
  start_date: Option<&str>,
  end_date: Option<&str>,
  fallback: Option<&str>,
) -> Option<String> {
  let a = start_date.map(str::trim).filter(|s| !s.is_empty());
  let b = end_date.map(str::trim).filter(|s| !s.is_empty());
  match (a, b) {
    (Some(a), Some(b)) => Some(format!("{} - {}", format_edu_date(a), format_edu_date(b))),
    (Some(a), None) => Some(format!("{} - 至今", format_edu_date(a))),
    (None, Some(b)) => Some(format_edu_date(b)),
    (None, None) => fallback.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string),
  }
}

fn format_edu_date(iso: &str) -> String {
  // YYYY-MM-DD → YYYY.MM ; YYYY-MM → YYYY.MM
  let bytes = iso.as_bytes();
  if bytes.len() >= 7
    && bytes[0..4].iter().all(|c| c.is_ascii_digit())
    && bytes[4] == b'-'
    && bytes[5..7].iter().all(|c| c.is_ascii_digit())
  {
    return format!("{}.{}", &iso[0..4], &iso[5..7]);
  }
  iso.to_string()
}

const PRESENT_LABEL: &str = "至今";

/// Normalize stored module timeRange for canvas / DOCX.
/// Start-only (no range separator) → `… - 至今`.
pub fn display_module_time_range(time_range: Option<&str>) -> String {
  let Some(raw) = time_range.map(str::trim).filter(|s| !s.is_empty()) else {
    return String::new();
  };
  if raw.contains(PRESENT_LABEL) {
    return raw.to_string();
  }
  if raw.contains('-') || raw.contains('–') || raw.contains('—') {
    return raw.to_string();
  }
  // Also match `\s*[-–—]\s*` via simple scan for ascii hyphen with spaces already covered.
  if raw.contains(" - ") {
    return raw.to_string();
  }
  format!("{raw} - {PRESENT_LABEL}")
}

pub fn normalize_tags(tags: Option<&Value>) -> Value {
  let Some(arr) = tags.and_then(|v| v.as_array()) else {
    return json!([]);
  };
  let mut seen = std::collections::HashSet::new();
  let mut out = Vec::new();
  for t in arr {
    let Some(s) = t.as_str().map(str::trim).filter(|s| !s.is_empty()) else {
      continue;
    };
    if seen.insert(s.to_string()) {
      out.push(Value::String(s.to_string()));
    }
  }
  Value::Array(out)
}

pub fn normalize_education(items: Option<&Value>) -> Value {
  let Some(arr) = items.and_then(|v| v.as_array()) else {
    return json!([]);
  };
  if arr.is_empty() {
    return json!([]);
  }
  let mut out = Vec::new();
  for e in arr {
    let id = e
      .get("id")
      .and_then(|v| v.as_str())
      .filter(|s| !s.is_empty())
      .map(str::to_string)
      .unwrap_or_else(new_id);
    let school = e
      .get("school")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .trim()
      .to_string();
    let start = opt_trim_str(e.get("startDate"));
    let end = opt_trim_str(e.get("endDate"));
    let fallback = opt_trim_str(e.get("timeRange"));
    let time_range = education_time_range(
      start.as_deref(),
      end.as_deref(),
      fallback.as_deref(),
    );
    let mut obj = Map::new();
    obj.insert("id".into(), Value::String(id));
    obj.insert("school".into(), Value::String(school));
    // Always persist degree (even "") so UI does not mask missing as 「本科」.
    obj.insert(
      "degree".into(),
      Value::String(opt_trim_str(e.get("degree")).unwrap_or_default()),
    );
    insert_opt_str(&mut obj, "major", opt_trim_str(e.get("major")));
    insert_opt_str(&mut obj, "startDate", start);
    insert_opt_str(&mut obj, "endDate", end);
    insert_opt_str(&mut obj, "timeRange", time_range);
    insert_opt_str(&mut obj, "gpa", opt_trim_str(e.get("gpa")));
    insert_opt_str(&mut obj, "rank", opt_trim_str(e.get("rank")));
    insert_opt_str(&mut obj, "courses", opt_trim_str(e.get("courses")));
    out.push(Value::Object(obj));
  }
  Value::Array(out)
}

pub fn normalize_skills(items: Option<&Value>) -> Value {
  let Some(arr) = items.and_then(|v| v.as_array()) else {
    return json!([]);
  };
  if arr.is_empty() {
    return json!([]);
  }
  let mut out = Vec::new();
  for s in arr {
    let id = s
      .get("id")
      .and_then(|v| v.as_str())
      .filter(|x| !x.is_empty())
      .map(str::to_string)
      .unwrap_or_else(new_id);
    let title = s
      .get("title")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .trim()
      .to_string();
    let body = s
      .get("body")
      .and_then(|v| v.as_str())
      .unwrap_or("")
      .trim()
      .to_string();
    if title.is_empty() && body.is_empty() {
      continue;
    }
    out.push(json!({ "id": id, "title": title, "body": body }));
  }
  Value::Array(out)
}

/// Deep-clone a JSON array of objects (education / skills), minting fresh `id`s
/// so a profile copy does not share nested identity with the source row.
pub fn remint_json_array_ids(items: &Value) -> Value {
  let Some(arr) = items.as_array() else {
    return items.clone();
  };
  Value::Array(
    arr
      .iter()
      .map(|item| {
        let mut obj = match item.as_object() {
          Some(m) => m.clone(),
          None => return item.clone(),
        };
        obj.insert("id".into(), Value::String(new_id()));
        Value::Object(obj)
      })
      .collect(),
  )
}

fn opt_trim_str(v: Option<&Value>) -> Option<String> {
  v.and_then(|x| x.as_str())
    .map(str::trim)
    .filter(|s| !s.is_empty())
    .map(str::to_string)
}

fn insert_opt_str(obj: &mut Map<String, Value>, key: &str, val: Option<String>) {
  if let Some(v) = val {
    obj.insert(key.into(), Value::String(v));
  }
}

/// Deep-copy module fields into a placement snapshot (snapshot-on-drop).
pub fn snapshot_from_module(mod_: &ContentModule) -> Value {
  let mut obj = Map::new();
  obj.insert("sourceModuleId".into(), Value::String(mod_.id.clone()));
  obj.insert("category".into(), Value::String(mod_.category.clone()));
  obj.insert("title".into(), Value::String(mod_.title.clone()));
  if let Some(ref s) = mod_.subtitle {
    obj.insert("subtitle".into(), Value::String(s.clone()));
  }
  if let Some(ref s) = mod_.project_type {
    obj.insert("projectType".into(), Value::String(s.clone()));
  }
  if let Some(ref s) = mod_.time_range {
    obj.insert("timeRange".into(), Value::String(s.clone()));
  }
  obj.insert("body".into(), Value::String(mod_.body.clone()));
  let tags = mod_
    .tags
    .as_array()
    .cloned()
    .unwrap_or_default();
  obj.insert("tags".into(), Value::Array(tags));
  obj.insert("snapshottedAt".into(), Value::String(now_iso()));
  Value::Object(obj)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn profile_required_and_edu_range() {
    assert!(validate_profile_required(Some("A"), Some("男"), Some("a@b.c"), Some("1"), Some("w")).is_ok());
    assert!(validate_profile_required(Some(""), Some("男"), Some("a@b.c"), Some("1"), Some("w")).is_err());
    assert_eq!(
      education_time_range(Some("2023-09-01"), Some("2027-06-30"), None).as_deref(),
      Some("2023.09 - 2027.06")
    );
    assert_eq!(
      education_time_range(Some("2026-01"), None, None).as_deref(),
      Some("2026.01 - 至今")
    );
    assert_eq!(display_module_time_range(Some("2026.01")), "2026.01 - 至今");
    assert_eq!(
      display_module_time_range(Some("2024.01 - 2025.06")),
      "2024.01 - 2025.06"
    );
  }

  #[test]
  fn matrix_and_placeable() {
    assert!(category_allowed_in_section("project", "projects"));
    assert!(!category_allowed_in_section("project", "awards"));
    assert!(is_placeable_section("projects"));
    assert!(!is_placeable_section("skills"));
  }
}
