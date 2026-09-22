import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import {
  MODULE_DRAG_MIME,
  decideModuleDrop,
  parseModuleDragPayload,
  serializeModuleDragPayload,
} from '@resume/domain';
import { buildApp } from './index.js';

describe('S2 tag filter + DnD placement pipeline', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-s2-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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

  it('filters modules by user tags (no JD)', async () => {
    await json('POST', '/api/modules', {
      category: 'project',
      title: 'A',
      body: 'body',
      tags: ['React', '前端'],
    });
    await json('POST', '/api/modules', {
      category: 'project',
      title: 'B',
      body: 'body',
      tags: ['Go', '后端'],
    });

    const reactOnly = await json<Array<{ title: string }>>(
      'GET',
      '/api/modules?tag=React',
    );
    assert.ok(reactOnly.some((m) => m.title === 'A'));
    assert.ok(!reactOnly.some((m) => m.title === 'B'));

    const backend = await json<Array<{ title: string }>>(
      'GET',
      '/api/modules?tag=后端',
    );
    assert.ok(backend.some((m) => m.title === 'B'));
  });

  it('DnD payload + decideModuleDrop then placement creates isolated snapshot', async () => {
    const mod = await json<{ id: string; category: string; title: string }>(
      'POST',
      '/api/modules',
      {
        category: 'internship',
        title: '拖拽前标题',
        body: '实习正文',
        tags: ['实习'],
      },
    );

    const payloadRaw = serializeModuleDragPayload({
      moduleId: mod.id,
      category: 'internship',
    });
    // Simulate what the browser stores under MODULE_DRAG_MIME.
    assert.equal(MODULE_DRAG_MIME, 'application/x-resume-module');
    const parsed = parseModuleDragPayload(payloadRaw);
    assert.ok(parsed);
    assert.equal(decideModuleDrop(parsed.category, 'internships'), 'accept');
    assert.equal(decideModuleDrop(parsed.category, 'projects'), 'reject-category');

    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: 'S2拖拽稿',
    });

    const placement = await json<{
      snapshot: { title: string; body: string };
    }>('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'internships',
      moduleId: parsed.moduleId,
    });
    assert.equal(placement.snapshot.title, '拖拽前标题');

    await json('PUT', `/api/modules/${mod.id}`, {
      category: 'internship',
      title: '库内已改',
      body: '不应出现在快照',
      tags: ['实习'],
    });

    const after = await json<{
      placements: Array<{ snapshot: { title: string; body: string } }>;
    }>('GET', `/api/resumes/${resume.id}`);
    assert.equal(after.placements[0]?.snapshot.title, '拖拽前标题');
    assert.equal(after.placements[0]?.snapshot.body, '实习正文');

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    assert.ok(buf.length > 0);
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
