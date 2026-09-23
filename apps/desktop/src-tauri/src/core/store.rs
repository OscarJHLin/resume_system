//! Read-only store — mirrors list/get helpers in `apps/server/src/db/store.ts`.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};

use crate::core::db::photos_dir;
use crate::core::error::ApiError;
use crate::core::models::{
  ContentModule, Profile, ResumeDocument, ResumeSummary, SectionPlacement,
};

pub struct Store {
  conn: Mutex<Connection>,
  db_path: PathBuf,
}

impl Store {
  pub fn new(conn: Connection, db_path: PathBuf) -> Self {
    Self {
      conn: Mutex::new(conn),
      db_path,
    }
  }

  pub fn db_path(&self) -> &Path {
    &self.db_path
  }

  pub fn list_profiles(&self, q: Option<&str>, tag: Option<&str>) -> Result<Vec<Profile>, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let mut stmt = conn
      .prepare("SELECT * FROM profile ORDER BY updated_at DESC")
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    let rows = stmt
      .query_map([], |row| self.map_profile_row(row))
      .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut out = Vec::new();
    for row in rows {
      let p = row.map_err(|e| ApiError::Internal(e.to_string()))?;
      if !profile_matches(&p, q, tag) {
        continue;
      }
      out.push(p);
    }
    Ok(out)
  }

  pub fn get_profile(&self, id: &str) -> Result<Profile, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let mut stmt = conn
      .prepare("SELECT * FROM profile WHERE id = ?1")
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    let profile = stmt
      .query_row([id], |row| self.map_profile_row(row))
      .optional()
      .map_err(|e| ApiError::Internal(e.to_string()))?
      .ok_or_else(|| ApiError::not_found(format!("Profile {id} not found")))?;
    Ok(profile)
  }

  pub fn get_profile_photo(
    &self,
    id: &str,
  ) -> Result<Option<(Vec<u8>, String, String)>, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let filename: Option<String> = conn
      .query_row(
        "SELECT photo_filename FROM profile WHERE id = ?1",
        [id],
        |row| row.get(0),
      )
      .optional()
      .map_err(|e| ApiError::Internal(e.to_string()))?
      .ok_or_else(|| ApiError::not_found(format!("Profile {id} not found")))?;

    let Some(name) = filename else {
      return Ok(None);
    };
    let full = photos_dir(&self.db_path).join(&name);
    if !full.is_file() {
      return Ok(None);
    }
    let bytes = std::fs::read(&full).map_err(|e| ApiError::Internal(e.to_string()))?;
    let ext = full
      .extension()
      .and_then(|e| e.to_str())
      .unwrap_or("jpg")
      .to_lowercase();
    let mime = match ext.as_str() {
      "png" => "image/png",
      "webp" => "image/webp",
      _ => "image/jpeg",
    };
    Ok(Some((bytes, mime.into(), name)))
  }

  pub fn list_modules(
    &self,
    category: Option<&str>,
    tag: Option<&str>,
    q: Option<&str>,
  ) -> Result<Vec<ContentModule>, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let mut stmt = conn
      .prepare("SELECT * FROM content_module ORDER BY updated_at DESC")
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    let rows = stmt
      .query_map([], |row| self.map_module_row(row))
      .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut out = Vec::new();
    for row in rows {
      let m = row.map_err(|e| ApiError::Internal(e.to_string()))?;
      if let Some(cat) = category {
        if m.category != cat {
          continue;
        }
      }
      if !module_matches(&m, q, tag) {
        continue;
      }
      out.push(m);
    }
    Ok(out)
  }

  pub fn get_module(&self, id: &str) -> Result<ContentModule, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let mut stmt = conn
      .prepare("SELECT * FROM content_module WHERE id = ?1")
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    stmt
      .query_row([id], |row| self.map_module_row(row))
      .optional()
      .map_err(|e| ApiError::Internal(e.to_string()))?
      .ok_or_else(|| ApiError::not_found(format!("Module {id} not found")))
  }

  pub fn list_resumes(&self) -> Result<Vec<ResumeSummary>, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let mut stmt = conn
      .prepare(
        "SELECT id, title, template_id, profile_id, updated_at FROM resume ORDER BY updated_at DESC",
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    let rows = stmt
      .query_map([], |row| {
        Ok(ResumeSummary {
          id: row.get(0)?,
          title: row.get(1)?,
          template_id: row.get(2)?,
          profile_id: row
            .get::<_, Option<String>>(3)?
            .unwrap_or_default(),
          updated_at: row.get(4)?,
        })
      })
      .map_err(|e| ApiError::Internal(e.to_string()))?;

    let mut out = Vec::new();
    for row in rows {
      out.push(row.map_err(|e| ApiError::Internal(e.to_string()))?);
    }
    Ok(out)
  }

  pub fn get_resume(&self, id: &str) -> Result<ResumeDocument, ApiError> {
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let row = conn
      .query_row(
        "SELECT id, title, template_id, profile_id, updated_at FROM resume WHERE id = ?1",
        [id],
        |row| {
          Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            row.get::<_, String>(4)?,
          ))
        },
      )
      .optional()
      .map_err(|e| ApiError::Internal(e.to_string()))?
      .ok_or_else(|| ApiError::not_found(format!("Resume {id} not found")))?;

    let mut stmt = conn
      .prepare(
        "SELECT id, section, sort_order, snapshot_json FROM section_placement
         WHERE resume_id = ?1 ORDER BY section, sort_order",
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    let placements = stmt
      .query_map([id], |p| {
        let snapshot_raw: String = p.get(3)?;
        let snapshot = parse_json_value(
          &snapshot_raw,
          json!({
            "sourceModuleId": "",
            "category": "project",
            "title": "",
            "body": "",
            "tags": [],
            "snapshottedAt": ""
          }),
        );
        Ok(SectionPlacement {
          id: p.get(0)?,
          section: p.get(1)?,
          sort_order: p.get(2)?,
          snapshot,
        })
      })
      .map_err(|e| ApiError::Internal(e.to_string()))?
      .collect::<Result<Vec<_>, _>>()
      .map_err(|e| ApiError::Internal(e.to_string()))?;

    Ok(ResumeDocument {
      id: row.0,
      title: row.1,
      template_id: row.2,
      profile_id: row.3,
      placements,
      updated_at: row.4,
    })
  }

  fn map_profile_row(&self, row: &rusqlite::Row<'_>) -> rusqlite::Result<Profile> {
    let photo_filename: Option<String> = row.get("photo_filename")?;
    let updated_at: String = row.get("updated_at")?;
    let created_at: Option<String> = row.get("created_at")?;
    let education_json: String = row.get("education_json")?;
    let skills_json: Option<String> = row.get("skills_json")?;
    let tags_json: Option<String> = row.get("tags_json")?;

    let mut has_photo = false;
    if let Some(ref name) = photo_filename {
      let full = photos_dir(&self.db_path).join(name);
      has_photo = full.is_file();
    }
    if !has_photo && photo_filename.is_none() {
      let legacy = photos_dir(&self.db_path).join("profile.jpg");
      has_photo = legacy.is_file();
    }

    let gender: Option<String> = row.get("gender")?;
    Ok(Profile {
      id: row.get("id")?,
      name: row.get("name")?,
      gender: gender.unwrap_or_default(),
      phone: opt_string(row.get("phone")?),
      email: opt_string(row.get("email")?),
      wechat: opt_string(row.get("wechat")?),
      qq: opt_string(row.get("qq")?),
      location: opt_string(row.get("location")?),
      summary: opt_string(row.get("summary")?),
      statement: opt_string(row.get("statement")?),
      education: parse_json_value(&education_json, json!([])),
      skills: parse_json_value(skills_json.as_deref().unwrap_or("[]"), json!([])),
      tags: parse_json_value(tags_json.as_deref().unwrap_or("[]"), json!([])),
      notes: opt_string(row.get("notes")?),
      has_photo,
      created_at: created_at.filter(|s| !s.is_empty()).unwrap_or(updated_at.clone()),
      updated_at,
    })
  }

  fn map_module_row(&self, row: &rusqlite::Row<'_>) -> rusqlite::Result<ContentModule> {
    let tags_json: String = row.get("tags_json")?;
    Ok(ContentModule {
      id: row.get("id")?,
      category: row.get("category")?,
      title: row.get("title")?,
      subtitle: opt_string(row.get("subtitle")?),
      project_type: opt_string(row.get("project_type")?),
      time_range: opt_string(row.get("time_range")?),
      body: row.get("body")?,
      tags: parse_json_value(&tags_json, json!([])),
      created_at: row.get("created_at")?,
      updated_at: row.get("updated_at")?,
    })
  }
}

/// SQL NULL → omit field; empty string kept (matches Node `row.x ?? undefined`).
fn opt_string(v: Option<String>) -> Option<String> {
  v
}

fn parse_json_value(raw: &str, fallback: Value) -> Value {
  serde_json::from_str(raw).unwrap_or(fallback)
}

fn profile_matches(p: &Profile, q: Option<&str>, tag: Option<&str>) -> bool {
  if let Some(needle) = tag {
    let needle = needle.to_lowercase();
    let tags = p.tags.as_array().cloned().unwrap_or_default();
    let ok = tags.iter().any(|t| {
      t.as_str()
        .map(|s| s.to_lowercase().contains(&needle))
        .unwrap_or(false)
    });
    if !ok {
      return false;
    }
  }
  if let Some(q) = q {
    let q = q.to_lowercase();
    let mut parts: Vec<String> = vec![
      p.name.clone(),
      p.email.clone().unwrap_or_default(),
      p.phone.clone().unwrap_or_default(),
      p.wechat.clone().unwrap_or_default(),
      p.summary.clone().unwrap_or_default(),
      p.statement.clone().unwrap_or_default(),
      p.notes.clone().unwrap_or_default(),
    ];
    if let Some(arr) = p.tags.as_array() {
      for t in arr {
        if let Some(s) = t.as_str() {
          parts.push(s.to_string());
        }
      }
    }
    if let Some(arr) = p.education.as_array() {
      for e in arr {
        if let Some(school) = e.get("school").and_then(|v| v.as_str()) {
          parts.push(school.to_string());
        }
      }
    }
    if let Some(arr) = p.skills.as_array() {
      for s in arr {
        let title = s.get("title").and_then(|v| v.as_str()).unwrap_or("");
        let body = s.get("body").and_then(|v| v.as_str()).unwrap_or("");
        parts.push(format!("{title} {body}"));
      }
    }
    let hay = parts.join("\n").to_lowercase();
    if !hay.contains(&q) {
      return false;
    }
  }
  true
}

fn module_matches(m: &ContentModule, q: Option<&str>, tag: Option<&str>) -> bool {
  if let Some(needle) = tag {
    let needle = needle.to_lowercase();
    let tags = m.tags.as_array().cloned().unwrap_or_default();
    let ok = tags.iter().any(|t| {
      t.as_str()
        .map(|s| s.to_lowercase().contains(&needle))
        .unwrap_or(false)
    });
    if !ok {
      return false;
    }
  }
  if let Some(q) = q {
    let q = q.to_lowercase();
    let mut parts = vec![m.title.clone(), m.body.clone()];
    if let Some(arr) = m.tags.as_array() {
      for t in arr {
        if let Some(s) = t.as_str() {
          parts.push(s.to_string());
        }
      }
    }
    let hay = parts.join("\n").to_lowercase();
    if !hay.contains(&q) {
      return false;
    }
  }
  true
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::core::db::open_database;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn seed_db() -> (Store, PathBuf) {
    let nanos = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap()
      .as_nanos();
    let path = std::env::temp_dir().join(format!("pinlu-store-{nanos}.db"));
    let _ = std::fs::remove_file(&path);
    let conn = open_database(&path).unwrap();
    conn.execute(
      "INSERT INTO profile (
        id, name, gender, phone, email, wechat, education_json, skills_json, tags_json,
        created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '[]', '[\"rust\"]', ?7, ?7)",
      rusqlite::params![
        "p1",
        "Alice",
        "女",
        "13800000000",
        "a@ex.com",
        "wx",
        "2026-01-01T00:00:00.000Z"
      ],
    )
    .unwrap();
    conn.execute(
      "INSERT INTO content_module (
        id, category, title, body, tags_json, created_at, updated_at
      ) VALUES ('m1', 'project', 'Demo', 'body', '[\"tag1\"]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')",
      [],
    )
    .unwrap();
    conn.execute(
      "INSERT INTO resume (id, title, template_id, profile_id, updated_at)
       VALUES ('r1', 'R', 'default-v1', 'p1', '2026-01-01T00:00:00.000Z')",
      [],
    )
    .unwrap();
    conn.execute(
      "INSERT INTO section_placement (id, resume_id, section, sort_order, snapshot_json)
       VALUES ('pl1', 'r1', 'projects', 0, ?1)",
      [r#"{"sourceModuleId":"m1","category":"project","title":"Demo","body":"body","tags":["tag1"],"snapshottedAt":"2026-01-01T00:00:00.000Z"}"#],
    )
    .unwrap();
    (Store::new(conn, path.clone()), path)
  }

  #[test]
  fn list_and_get_roundtrip_shapes() {
    let (store, path) = seed_db();
    let profiles = store.list_profiles(None, None).unwrap();
    assert_eq!(profiles.len(), 1);
    assert_eq!(profiles[0].name, "Alice");
    assert_eq!(profiles[0].has_photo, false);

    let filtered = store.list_profiles(Some("alice"), Some("rust")).unwrap();
    assert_eq!(filtered.len(), 1);

    let modules = store.list_modules(Some("project"), None, None).unwrap();
    assert_eq!(modules.len(), 1);
    assert_eq!(modules[0].title, "Demo");

    let resume = store.get_resume("r1").unwrap();
    assert_eq!(resume.placements.len(), 1);
    assert_eq!(resume.placements[0].snapshot["title"], "Demo");

    let json = serde_json::to_value(&resume).unwrap();
    assert!(json.get("templateId").is_some());
    assert!(json.get("profileId").is_some());
    assert!(json["placements"][0].get("sortOrder").is_some());

    let _ = std::fs::remove_file(&path);
  }
}
