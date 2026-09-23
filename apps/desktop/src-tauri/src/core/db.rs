//! SQLite open + schema (same as apps/server/src/db/client.ts).
//! Additive CREATE / ALTER only — never drop or truncate user tables.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  gender TEXT,
  phone TEXT,
  email TEXT,
  wechat TEXT,
  qq TEXT,
  location TEXT,
  summary TEXT,
  statement TEXT,
  education_json TEXT NOT NULL DEFAULT '[]',
  skills_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  photo_filename TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_module (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  project_type TEXT,
  time_range TEXT,
  body TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resume (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  profile_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS section_placement (
  id TEXT PRIMARY KEY,
  resume_id TEXT NOT NULL,
  section TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  FOREIGN KEY (resume_id) REFERENCES resume(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_module_category ON content_module(category);
CREATE INDEX IF NOT EXISTS idx_placement_resume ON section_placement(resume_id);
CREATE INDEX IF NOT EXISTS idx_profile_updated ON profile(updated_at);
"#;

/// Photos live next to the SQLite file: `<dbDir>/photos/`.
pub fn photos_dir(db_path: &Path) -> PathBuf {
  let dir = db_path
    .parent()
    .unwrap_or_else(|| Path::new("."))
    .join("photos");
  let _ = fs::create_dir_all(&dir);
  dir
}

/// Open (or create) SQLite. Schema uses CREATE IF NOT EXISTS + additive ALTER only.
pub fn open_database(db_path: &Path) -> Result<Connection, String> {
  if let Some(dir) = db_path.parent() {
    fs::create_dir_all(dir).map_err(|e| format!("create db dir: {e}"))?;
  }
  let conn = Connection::open(db_path).map_err(|e| format!("open sqlite: {e}"))?;
  conn
    .execute_batch(
      "PRAGMA foreign_keys = ON;
       PRAGMA journal_mode = WAL;
       PRAGMA synchronous = NORMAL;",
    )
    .map_err(|e| format!("pragma: {e}"))?;
  conn
    .execute_batch(SCHEMA)
    .map_err(|e| format!("schema: {e}"))?;
  migrate_profile_columns(&conn)?;
  Ok(conn)
}

fn migrate_profile_columns(conn: &Connection) -> Result<(), String> {
  let mut stmt = conn
    .prepare("PRAGMA table_info(profile)")
    .map_err(|e| e.to_string())?;
  let cols: std::collections::HashSet<String> = stmt
    .query_map([], |row| row.get::<_, String>(1))
    .map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

  let add = |name: &str, ddl: &str| -> Result<(), String> {
    if !cols.contains(name) {
      conn
        .execute_batch(&format!("ALTER TABLE profile ADD COLUMN {ddl}"))
        .map_err(|e| format!("ALTER {name}: {e}"))?;
    }
    Ok(())
  };

  add("photo_filename", "photo_filename TEXT")?;
  add("gender", "gender TEXT")?;
  add("wechat", "wechat TEXT")?;
  add("qq", "qq TEXT")?;
  add("skills_json", "skills_json TEXT NOT NULL DEFAULT '[]'")?;
  add("tags_json", "tags_json TEXT NOT NULL DEFAULT '[]'")?;
  add("notes", "notes TEXT")?;
  add("created_at", "created_at TEXT")?;
  add("statement", "statement TEXT")?;

  conn
    .execute_batch(
      "UPDATE profile SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''",
    )
    .map_err(|e| e.to_string())?;
  Ok(())
}

/// Ensure SQLite file + photos dir exist (same contract as Node `ensureBuiltinLocalDb`).
pub fn ensure_db(db_path: &Path) -> Result<(Connection, PathBuf), String> {
  let conn = open_database(db_path)?;
  let photos = photos_dir(db_path);
  Ok((conn, photos))
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  fn tmp_db() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let nanos = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .unwrap()
      .as_nanos();
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("pinlu-phase1-{nanos}-{seq}.db"))
  }

  #[test]
  fn open_empty_db_creates_tables() {
    let path = tmp_db();
    let _ = fs::remove_file(&path);
    let conn = open_database(&path).expect("open");
    let n: i64 = conn
      .query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='profile'",
        [],
        |r| r.get(0),
      )
      .unwrap();
    assert_eq!(n, 1);
    let _ = fs::remove_file(&path);
    let _ = fs::remove_file(format!("{}-wal", path.display()));
    let _ = fs::remove_file(format!("{}-shm", path.display()));
  }

  #[test]
  fn reopen_existing_db_is_idempotent() {
    let path = tmp_db();
    let _ = fs::remove_file(&path);
    open_database(&path).unwrap();
    open_database(&path).unwrap();
    let _ = fs::remove_file(&path);
  }
}
