import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, after } from 'node:test';
import { openDatabase } from './db/client.js';

describe('SQLite local persistence', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pinlu-persist-'));
  const dbPath = path.join(dir, 'resume.db');

  after(() => {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('survives close and reopen on the same file path', () => {
    const db1 = openDatabase(dbPath);
    db1
      .prepare(
        `INSERT INTO resume (id, title, template_id, profile_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run('r1', '持久化简历', 'default-v1', '', new Date().toISOString());
    db1.close();

    assert.ok(fs.existsSync(dbPath));

    const db2 = openDatabase(dbPath);
    const row = db2
      .prepare(`SELECT title FROM resume WHERE id = ?`)
      .get('r1') as { title: string } | undefined;
    assert.equal(row?.title, '持久化简历');
    db2.close();
  });
});
