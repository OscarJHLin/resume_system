import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './index.js';

describe('S4 placement delete + reorder', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-s4-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
    );
    const built = buildApp(dbPath);
    app = await built.start();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') throw new Error('expected TCP');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await app.close();
    try {
      fs.unlinkSync(dbPath);
    } catch {
      /* ignore */
    }
  });

  it('deletes a placement and keeps others', async () => {
    const a = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: 'A',
      body: 'a',
      tags: [],
    });
    const b = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: 'B',
      body: 'b',
      tags: [],
    });
    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: 'S4',
    });
    const p1 = await json<{ id: string }>(
      'POST',
      `/api/resumes/${resume.id}/placements`,
      { section: 'projects', moduleId: a.id },
    );
    await json('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'projects',
      moduleId: b.id,
    });

    const del = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/placements/${p1.id}`,
      { method: 'DELETE' },
    );
    assert.equal(del.status, 204);

    const after = await json<{
      placements: Array<{ id: string; snapshot: { title: string } }>;
    }>('GET', `/api/resumes/${resume.id}`);
    assert.equal(after.placements.length, 1);
    assert.equal(after.placements[0]?.snapshot.title, 'B');
  });

  it('reorders placements within a section then exports', async () => {
    const m1 = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: 'First',
      body: '1',
      tags: ['x'],
    });
    const m2 = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: 'Second',
      body: '2',
      tags: ['x'],
    });
    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: 'Reorder',
    });
    const p1 = await json<{ id: string }>(
      'POST',
      `/api/resumes/${resume.id}/placements`,
      { section: 'projects', moduleId: m1.id },
    );
    const p2 = await json<{ id: string }>(
      'POST',
      `/api/resumes/${resume.id}/placements`,
      { section: 'projects', moduleId: m2.id },
    );

    const reordered = await json<{
      placements: Array<{ id: string; sortOrder: number }>;
    }>('PATCH', `/api/resumes/${resume.id}/placements/reorder`, {
      section: 'projects',
      orderedPlacementIds: [p2.id, p1.id],
    });
    const projects = reordered.placements
      .filter((p) => p.id === p1.id || p.id === p2.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    assert.equal(projects[0]?.id, p2.id);
    assert.equal(projects[1]?.id, p1.id);

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString('utf8'), 'PK');
  });

  async function json<T>(
    method: string,
    urlPath: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    assert.ok(res.ok, `${method} ${urlPath} -> ${res.status}: ${text}`);
    if (!text) return undefined as T;
    return JSON.parse(text) as T;
  }
});
