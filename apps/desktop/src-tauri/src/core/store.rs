//! Store — mirrors `apps/server/src/db/store.ts` (read + write).

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::{Connection, OptionalExtension};
use serde_json::{json, Value};

use crate::core::db::photos_dir;
use crate::core::domain::{
  new_id, normalize_education, normalize_skills, normalize_tags, now_iso,
  remint_json_array_ids,
  validate_profile_required,
};
use crate::core::error::ApiError;
use crate::core::models::{
  ContentModule, Profile, ResumeDocument, ResumeSummary, SectionPlacement,
};
use crate::core::templates::DEFAULT_TEMPLATE_ID;

pub struct ProfileInput<'a> {
  pub name: &'a str,
  pub gender: &'a str,
  pub phone: &'a str,
  pub email: &'a str,
  pub wechat: &'a str,
  pub qq: Option<&'a str>,
  pub location: Option<&'a str>,
  pub summary: Option<&'a str>,
  pub statement: Option<&'a str>,
  pub education: Option<&'a Value>,
  pub skills: Option<&'a Value>,
  pub tags: Option<&'a Value>,
  pub notes: Option<&'a str>,
}

pub struct ModuleInput<'a> {
  pub category: &'a str,
  pub title: &'a str,
  pub subtitle: Option<&'a str>,
  pub project_type: Option<&'a str>,
  pub time_range: Option<&'a str>,
  pub body: &'a str,
  pub tags: Option<&'a Value>,
}

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

  pub fn create_profile(&self, input: ProfileInput<'_>) -> Result<Profile, ApiError> {
    validate_profile_required(
      Some(input.name),
      Some(input.gender),
      Some(input.email),
      Some(input.phone),
      Some(input.wechat),
    )?;
    let ts = now_iso();
    let id = new_id();
    let education = normalize_education(input.education);
    let skills = normalize_skills(input.skills);
    let tags = normalize_tags(input.tags);
    let name = input.name.trim();
    let gender = input.gender.trim();
    let phone = input.phone.trim();
    let email = input.email.trim();
    let wechat = input.wechat.trim();
    let qq = trim_opt(input.qq);
    let location = trim_opt(input.location);
    let summary = trim_opt(input.summary);
    let statement = trim_opt(input.statement);
    let notes = trim_opt(input.notes);

    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          r#"INSERT INTO profile (
            id, name, gender, phone, email, wechat, qq, location, summary,
            statement, education_json, skills_json, tags_json, notes, photo_filename,
            created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, ?15, ?16)"#,
          rusqlite::params![
            id,
            name,
            gender,
            phone,
            email,
            wechat,
            qq,
            location,
            summary,
            statement,
            education.to_string(),
            skills.to_string(),
            tags.to_string(),
            notes,
            ts,
            ts,
          ],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_profile(&id)
  }

  pub fn update_profile(&self, id: &str, input: ProfileInput<'_>) -> Result<Profile, ApiError> {
    let _ = self.get_profile(id)?;
    validate_profile_required(
      Some(input.name),
      Some(input.gender),
      Some(input.email),
      Some(input.phone),
      Some(input.wechat),
    )?;
    let education = normalize_education(input.education);
    let skills = normalize_skills(input.skills);
    let tags = normalize_tags(input.tags);
    let updated_at = now_iso();
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          r#"UPDATE profile SET
            name = ?1, gender = ?2, phone = ?3, email = ?4, wechat = ?5, qq = ?6,
            location = ?7, summary = ?8, statement = ?9, education_json = ?10, skills_json = ?11,
            tags_json = ?12, notes = ?13, updated_at = ?14
           WHERE id = ?15"#,
          rusqlite::params![
            input.name.trim(),
            input.gender.trim(),
            input.phone.trim(),
            input.email.trim(),
            input.wechat.trim(),
            trim_opt(input.qq),
            trim_opt(input.location),
            trim_opt(input.summary),
            trim_opt(input.statement),
            education.to_string(),
            skills.to_string(),
            tags.to_string(),
            trim_opt(input.notes),
            updated_at,
            id,
          ],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_profile(id)
  }

  pub fn delete_profile(&self, id: &str) -> Result<(), ApiError> {
    let _ = self.get_profile(id)?;
    let _ = self.clear_profile_photo(id)?;
    let ts = now_iso();
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    conn
      .execute("DELETE FROM profile WHERE id = ?1", [id])
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    conn
      .execute(
        "UPDATE resume SET profile_id = '', updated_at = ?1 WHERE profile_id = ?2",
        rusqlite::params![ts, id],
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(())
  }

  /// Full deep clone of a profile card (new id); photo file duplicated when present.
  /// Persisted columns are copied verbatim (education/skills JSON reminted with new
  /// nested ids only). Display name appends `（副本）`.
  pub fn copy_profile(&self, id: &str) -> Result<Profile, ApiError> {
    let src = self.get_profile(id)?;
    let new_id = new_id();
    let copy_name = format!("{}（副本）", src.name.trim());
    let ts = now_iso();
    // Verbatim field clone — do not re-run create/normalize (avoids defaults / drops).
    let education = remint_json_array_ids(&src.education);
    let skills = remint_json_array_ids(&src.skills);
    let tags = src.tags.clone();

    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          r#"INSERT INTO profile (
            id, name, gender, phone, email, wechat, qq, location, summary,
            statement, education_json, skills_json, tags_json, notes, photo_filename,
            created_at, updated_at
          ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, NULL, ?15, ?16)"#,
          rusqlite::params![
            new_id,
            copy_name,
            src.gender,
            src.phone,
            src.email,
            src.wechat,
            src.qq,
            src.location,
            src.summary,
            src.statement,
            education.to_string(),
            skills.to_string(),
            tags.to_string(),
            src.notes,
            ts,
            ts,
          ],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }

    if let Some((bytes, mime, _)) = self.get_profile_photo(id)? {
      let ext = if mime.contains("png") {
        "png"
      } else if mime.contains("webp") {
        "webp"
      } else {
        "jpg"
      };
      return self.save_profile_photo(&new_id, &bytes, ext);
    }
    if src.has_photo {
      let legacy = photos_dir(&self.db_path).join("profile.jpg");
      if legacy.is_file() {
        let bytes =
          std::fs::read(&legacy).map_err(|e| ApiError::Internal(e.to_string()))?;
        return self.save_profile_photo(&new_id, &bytes, "jpg");
      }
    }
    self.get_profile(&new_id)
  }

  pub fn save_profile_photo(
    &self,
    profile_id: &str,
    bytes: &[u8],
    ext: &str,
  ) -> Result<Profile, ApiError> {
    let _ = self.get_profile(profile_id)?;
    let safe_ext = ext.trim_start_matches('.').to_lowercase();
    if !matches!(safe_ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
      return Err(ApiError::bad_request("photo must be jpg, png, or webp"));
    }
    let filename = format!(
      "{}.{}",
      profile_id,
      if safe_ext == "jpeg" { "jpg" } else { &safe_ext }
    );
    let dir = photos_dir(&self.db_path);
    if let Ok(entries) = std::fs::read_dir(&dir) {
      for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.starts_with(&format!("{profile_id}.")) {
          let _ = std::fs::remove_file(entry.path());
        }
      }
    }
    std::fs::write(dir.join(&filename), bytes).map_err(|e| ApiError::Internal(e.to_string()))?;
    let ts = now_iso();
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "UPDATE profile SET photo_filename = ?1, updated_at = ?2 WHERE id = ?3",
          rusqlite::params![filename, ts, profile_id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_profile(profile_id)
  }

  pub fn clear_profile_photo(&self, profile_id: &str) -> Result<Profile, ApiError> {
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      let filename: Option<String> = conn
        .query_row(
          "SELECT photo_filename FROM profile WHERE id = ?1",
          [profile_id],
          |row| row.get(0),
        )
        .optional()
        .map_err(|e| ApiError::Internal(e.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Profile {profile_id} not found")))?;
      if let Some(name) = filename {
        let full = photos_dir(&self.db_path).join(&name);
        if full.is_file() {
          let _ = std::fs::remove_file(full);
        }
      }
      let ts = now_iso();
      conn
        .execute(
          "UPDATE profile SET photo_filename = NULL, updated_at = ?1 WHERE id = ?2",
          rusqlite::params![ts, profile_id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_profile(profile_id)
  }

  pub fn create_module(&self, input: ModuleInput<'_>) -> Result<ContentModule, ApiError> {
    if input.title.trim().is_empty() {
      return Err(ApiError::bad_request("title is required"));
    }
    let ts = now_iso();
    let id = new_id();
    let tags = normalize_tags(input.tags);
    let title = input.title.trim().to_string();
    let mod_ = ContentModule {
      id: id.clone(),
      category: input.category.to_string(),
      title: title.clone(),
      subtitle: input.subtitle.map(str::to_string),
      project_type: input.project_type.map(str::to_string),
      time_range: input.time_range.map(str::to_string),
      body: input.body.to_string(),
      tags: tags.clone(),
      created_at: ts.clone(),
      updated_at: ts.clone(),
    };
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    conn
      .execute(
        r#"INSERT INTO content_module
         (id, category, title, subtitle, project_type, time_range, body, tags_json, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"#,
        rusqlite::params![
          mod_.id,
          mod_.category,
          mod_.title,
          mod_.subtitle,
          mod_.project_type,
          mod_.time_range,
          mod_.body,
          tags.to_string(),
          mod_.created_at,
          mod_.updated_at,
        ],
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(mod_)
  }

  pub fn update_module(&self, id: &str, input: ModuleInput<'_>) -> Result<ContentModule, ApiError> {
    let _ = self.get_module(id)?;
    if input.title.trim().is_empty() {
      return Err(ApiError::bad_request("title is required"));
    }
    let tags = normalize_tags(input.tags);
    let updated_at = now_iso();
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          r#"UPDATE content_module SET category = ?1, title = ?2, subtitle = ?3, project_type = ?4,
           time_range = ?5, body = ?6, tags_json = ?7, updated_at = ?8 WHERE id = ?9"#,
          rusqlite::params![
            input.category,
            input.title.trim(),
            input.subtitle,
            input.project_type,
            input.time_range,
            input.body,
            tags.to_string(),
            updated_at,
            id,
          ],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_module(id)
  }

  pub fn delete_module(&self, id: &str) -> Result<(), ApiError> {
    let _ = self.get_module(id)?;
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    conn
      .execute("DELETE FROM content_module WHERE id = ?1", [id])
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(())
  }

  pub fn create_resume(
    &self,
    title: Option<&str>,
    template_id: Option<&str>,
    profile_id: Option<&str>,
    templates_ok: impl Fn(&str) -> bool,
  ) -> Result<ResumeDocument, ApiError> {
    let template_id = template_id.unwrap_or(DEFAULT_TEMPLATE_ID);
    if !templates_ok(template_id) {
      return Err(ApiError::bad_request(format!("unknown template: {template_id}")));
    }
    if let Some(pid) = profile_id.filter(|s| !s.is_empty()) {
      let _ = self.get_profile(pid)?;
    }
    let id = new_id();
    let updated_at = now_iso();
    let doc_title = title
      .map(str::trim)
      .filter(|s| !s.is_empty())
      .unwrap_or("未命名简历");
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "INSERT INTO resume (id, title, template_id, profile_id, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
          rusqlite::params![id, doc_title, template_id, profile_id.unwrap_or(""), updated_at],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_resume(&id)
  }

  pub fn patch_resume(
    &self,
    id: &str,
    title: Option<&str>,
    profile_id: Option<Option<&str>>,
    template_id: Option<&str>,
    templates_ok: impl Fn(&str) -> bool,
  ) -> Result<ResumeDocument, ApiError> {
    let _ = self.get_resume(id)?;
    if let Some(t) = title {
      if t.trim().is_empty() {
        return Err(ApiError::bad_request("title cannot be empty"));
      }
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "UPDATE resume SET title = ?1, updated_at = ?2 WHERE id = ?3",
          rusqlite::params![t.trim(), now_iso(), id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    if let Some(tid) = template_id {
      if !templates_ok(tid) {
        return Err(ApiError::bad_request(format!("unknown template: {tid}")));
      }
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "UPDATE resume SET template_id = ?1, updated_at = ?2 WHERE id = ?3",
          rusqlite::params![tid, now_iso(), id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    if let Some(pid_opt) = profile_id {
      let pid = pid_opt.unwrap_or("");
      if !pid.is_empty() {
        let _ = self.get_profile(pid)?;
      }
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "UPDATE resume SET profile_id = ?1, updated_at = ?2 WHERE id = ?3",
          rusqlite::params![pid, now_iso(), id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_resume(id)
  }

  pub fn add_placement(
    &self,
    resume_id: &str,
    section: &str,
    snapshot: Value,
  ) -> Result<SectionPlacement, ApiError> {
    let resume = self.get_resume(resume_id)?;
    let max_order = resume
      .placements
      .iter()
      .filter(|p| p.section == section)
      .map(|p| p.sort_order)
      .max()
      .unwrap_or(-1);
    let placement = SectionPlacement {
      id: new_id(),
      section: section.to_string(),
      sort_order: max_order + 1,
      snapshot: snapshot.clone(),
    };
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          r#"INSERT INTO section_placement (id, resume_id, section, sort_order, snapshot_json)
           VALUES (?1, ?2, ?3, ?4, ?5)"#,
          rusqlite::params![
            placement.id,
            resume_id,
            section,
            placement.sort_order,
            snapshot.to_string(),
          ],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
      conn
        .execute(
          "UPDATE resume SET updated_at = ?1 WHERE id = ?2",
          rusqlite::params![now_iso(), resume_id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    Ok(placement)
  }

  pub fn reorder_placements(
    &self,
    resume_id: &str,
    section: &str,
    ordered_ids: &[String],
  ) -> Result<ResumeDocument, ApiError> {
    let resume = self.get_resume(resume_id)?;
    let section_ids: std::collections::HashSet<_> = resume
      .placements
      .iter()
      .filter(|p| p.section == section)
      .map(|p| p.id.as_str())
      .collect();
    if ordered_ids.len() != section_ids.len()
      || ordered_ids.iter().any(|id| !section_ids.contains(id.as_str()))
    {
      return Err(ApiError::bad_request(
        "orderedPlacementIds must match section placements",
      ));
    }
    {
      let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
      for (index, pid) in ordered_ids.iter().enumerate() {
        conn
          .execute(
            "UPDATE section_placement SET sort_order = ?1 WHERE id = ?2 AND resume_id = ?3",
            rusqlite::params![index as i64, pid, resume_id],
          )
          .map_err(|e| ApiError::Internal(e.to_string()))?;
      }
      conn
        .execute(
          "UPDATE resume SET updated_at = ?1 WHERE id = ?2",
          rusqlite::params![now_iso(), resume_id],
        )
        .map_err(|e| ApiError::Internal(e.to_string()))?;
    }
    self.get_resume(resume_id)
  }

  pub fn delete_placement(&self, resume_id: &str, placement_id: &str) -> Result<(), ApiError> {
    let _ = self.get_resume(resume_id)?;
    let conn = self.conn.lock().map_err(|e| ApiError::Internal(e.to_string()))?;
    let n = conn
      .execute(
        "DELETE FROM section_placement WHERE id = ?1 AND resume_id = ?2",
        rusqlite::params![placement_id, resume_id],
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    if n == 0 {
      return Err(ApiError::not_found(format!(
        "Placement {placement_id} not found"
      )));
    }
    conn
      .execute(
        "UPDATE resume SET updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now_iso(), resume_id],
      )
      .map_err(|e| ApiError::Internal(e.to_string()))?;
    Ok(())
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
fn trim_opt(v: Option<&str>) -> Option<String> {
  v.map(str::trim).filter(|s| !s.is_empty()).map(str::to_string)
}

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
  use serde_json::json;
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

  #[test]
  fn create_update_delete_and_reorder() {
    let (store, path) = seed_db();
    let p = store
      .create_profile(ProfileInput {
        name: "Carol",
        gender: "女",
        phone: "139",
        email: "c@e.com",
        wechat: "wc",
        qq: None,
        location: Some("上海"),
        summary: None,
        statement: None,
        education: None,
        skills: None,
        tags: Some(&json!(["new"])),
        notes: None,
      })
      .unwrap();
    assert_eq!(p.name, "Carol");
    assert_eq!(p.location.as_deref(), Some("上海"));

    let m = store
      .create_module(ModuleInput {
        category: "internship",
        title: "Intern",
        subtitle: Some("Co"),
        project_type: None,
        time_range: Some("2024"),
        body: "did stuff",
        tags: Some(&json!(["job"])),
      })
      .unwrap();
    assert_eq!(m.category, "internship");

    let r = store
      .create_resume(Some("Doc"), None, Some(&p.id), |_| true)
      .unwrap();
    assert_eq!(r.title, "Doc");
    assert_eq!(r.profile_id, p.id);

    let snap = crate::core::domain::snapshot_from_module(&m);
    let pl = store.add_placement(&r.id, "internships", snap).unwrap();
    assert_eq!(pl.sort_order, 0);

    let m2 = store
      .create_module(ModuleInput {
        category: "internship",
        title: "Intern2",
        subtitle: None,
        project_type: None,
        time_range: None,
        body: "b2",
        tags: None,
      })
      .unwrap();
    let pl2 = store
      .add_placement(
        &r.id,
        "internships",
        crate::core::domain::snapshot_from_module(&m2),
      )
      .unwrap();
    assert_eq!(pl2.sort_order, 1);

    let reordered = store
      .reorder_placements(&r.id, "internships", &[pl2.id.clone(), pl.id.clone()])
      .unwrap();
    assert_eq!(reordered.placements[0].id, pl2.id);
    assert_eq!(reordered.placements[0].sort_order, 0);
    assert_eq!(reordered.placements[1].id, pl.id);

    store.delete_placement(&r.id, &pl.id).unwrap();
    store.delete_module(&m.id).unwrap();
    store.delete_profile(&p.id).unwrap();
    let detached = store.get_resume(&r.id).unwrap();
    assert_eq!(detached.profile_id, "");

    let _ = std::fs::remove_file(&path);
  }

  #[test]
  fn copy_profile_duplicates_fields_and_photo() {
    let (store, path) = seed_db();
    let education = json!([
      {
        "id": "edu-src-1",
        "school": "示例大学",
        "degree": "本科",
        "major": "软件工程",
        "startDate": "2020-09-01",
        "endDate": "2024-06-01",
        "gpa": "3.5/5",
        "rank": "专业前10%",
        "courses": "数据结构"
      },
      {
        "id": "edu-src-2",
        "school": "示例大学",
        "degree": "双学位",
        "major": "投资学",
        "startDate": "2020-09-01",
        "endDate": "2024-06-01",
        "gpa": "3.75/5",
        "rank": "专业前5%",
        "courses": "宏观经济学"
      }
    ]);
    let skills = json!([{ "id": "sk-1", "title": "语言", "body": "Rust" }]);
    let tags = json!(["校招", "双学位测"]);
    let src = store
      .create_profile(ProfileInput {
        name: "丁一",
        gender: "男",
        phone: "137",
        email: "d@e.com",
        wechat: "wd",
        qq: Some("123"),
        location: Some("北京"),
        summary: Some("后端开发"),
        statement: Some("个人优势陈述"),
        education: Some(&education),
        skills: Some(&skills),
        tags: Some(&tags),
        notes: Some("备注"),
      })
      .unwrap();
    let png = [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44,
      0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90,
      0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8,
      0xff, 0xff, 0x3f, 0x00, 0x05, 0xfe, 0x02, 0xfe, 0xa7, 0x35, 0x81, 0x84, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ];
    store.save_profile_photo(&src.id, &png, "png").unwrap();
    let src = store.get_profile(&src.id).unwrap();

    let copy = store.copy_profile(&src.id).unwrap();
    assert_ne!(copy.id, src.id);
    assert_eq!(copy.name, "丁一（副本）");
    assert_eq!(copy.gender, src.gender);
    assert_eq!(copy.phone, src.phone);
    assert_eq!(copy.email, src.email);
    assert_eq!(copy.wechat, src.wechat);
    assert_eq!(copy.qq, src.qq);
    assert_eq!(copy.location, src.location);
    assert_eq!(copy.summary, src.summary);
    assert_eq!(copy.statement, src.statement);
    assert_eq!(copy.notes, src.notes);
    assert_eq!(copy.tags, src.tags);
    assert_eq!(copy.education.as_array().unwrap().len(), 2);
    assert_eq!(
      copy.education[1]["degree"].as_str(),
      Some("双学位"),
      "degree must survive copy verbatim"
    );
    assert_eq!(copy.education[1]["major"].as_str(), Some("投资学"));
    assert_eq!(copy.education[1]["gpa"].as_str(), Some("3.75/5"));
    assert_eq!(copy.education[1]["rank"].as_str(), Some("专业前5%"));
    assert_eq!(copy.education[1]["courses"].as_str(), Some("宏观经济学"));
    assert_eq!(copy.education[0]["degree"].as_str(), Some("本科"));
    // Nested ids must be reminted — no shared mutable identity with source
    assert_ne!(
      copy.education[0]["id"].as_str(),
      src.education[0]["id"].as_str()
    );
    assert_ne!(
      copy.education[1]["id"].as_str(),
      src.education[1]["id"].as_str()
    );
    assert_ne!(copy.skills[0]["id"].as_str(), src.skills[0]["id"].as_str());
    assert_eq!(copy.skills[0]["body"].as_str(), Some("Rust"));
    assert!(copy.has_photo);

    let orig_photo = store.get_profile_photo(&src.id).unwrap().unwrap();
    let copy_photo = store.get_profile_photo(&copy.id).unwrap().unwrap();
    assert_eq!(orig_photo.0, copy_photo.0);
    assert_ne!(orig_photo.2, copy_photo.2);

    let still = store.get_profile(&src.id).unwrap();
    assert_eq!(still.name, "丁一");
    assert_eq!(still.education[1]["degree"].as_str(), Some("双学位"));
    assert!(still.has_photo);

    let photos = path.parent().unwrap().join("photos");
    let _ = std::fs::remove_dir_all(&photos);
    let _ = std::fs::remove_file(&path);
  }
}
