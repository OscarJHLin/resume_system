import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
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
`;

export type Db = DatabaseSync;

/**
 * Open (or create) SQLite. Schema uses CREATE IF NOT EXISTS + additive
 * ALTER only — never deletes/truncates user tables or files.
 */
export function openDatabase(dbPath: string): Db {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrateProfileColumns(db);
  return db;
}

/** Additive column migrations for older DBs. */
function migrateProfileColumns(db: Db): void {
  const cols = new Set(
    (
      db.prepare('PRAGMA table_info(profile)').all() as Array<{ name: string }>
    ).map((c) => c.name),
  );
  const add = (name: string, ddl: string) => {
    if (!cols.has(name)) db.exec(`ALTER TABLE profile ADD COLUMN ${ddl}`);
  };
  add('photo_filename', 'photo_filename TEXT');
  add('gender', 'gender TEXT');
  add('wechat', 'wechat TEXT');
  add('qq', 'qq TEXT');
  add('skills_json', "skills_json TEXT NOT NULL DEFAULT '[]'");
  add('tags_json', "tags_json TEXT NOT NULL DEFAULT '[]'");
  add('notes', 'notes TEXT');
  add('created_at', 'created_at TEXT');
  add('statement', 'statement TEXT');
  // Backfill created_at from updated_at when missing
  db.exec(
    `UPDATE profile SET created_at = updated_at WHERE created_at IS NULL OR created_at = ''`,
  );
}

export function defaultDbPath(): string {
  // Optional override for advanced/dev only — normal users never set this.
  // Desktop shell always injects OS app-data path; browser launcher uses ./data/.
  const override = process.env.RESUME_DB_PATH?.trim();
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), 'data', 'resume.db');
}

/** Photos live next to the SQLite file: <dbDir>/photos/ */
export function photosDir(dbPath: string = defaultDbPath()): string {
  const dir = path.join(path.dirname(dbPath), 'photos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Ensure SQLite file + photos dir exist. Called on every boot —
 * no user configuration / setup wizard required.
 */
export function ensureBuiltinLocalDb(dbPath: string = defaultDbPath()): {
  dbPath: string;
  photosDir: string;
  db: Db;
} {
  const db = openDatabase(dbPath);
  const photos = photosDir(dbPath);
  return { dbPath, photosDir: photos, db };
}
