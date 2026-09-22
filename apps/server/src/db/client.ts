import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  location TEXT,
  summary TEXT,
  education_json TEXT NOT NULL DEFAULT '[]',
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
  profile_id TEXT NOT NULL,
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
`;

export type Db = DatabaseSync;

export function openDatabase(dbPath: string): Db {
  const dir = path.dirname(dbPath);
  fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function defaultDbPath(): string {
  return (
    process.env.RESUME_DB_PATH ??
    path.join(process.cwd(), 'data', 'resume.db')
  );
}
