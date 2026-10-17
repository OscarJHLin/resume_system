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

  it('places campus module into campuses section', async () => {
    const mod = await json<{ id: string }>('POST', '/api/modules', {
      category: 'campus',
      title: '学生会外联部',
      projectType: '部长',
      subtitle: '校级',
      body: '负责赞助对接',
      tags: ['校园'],
    });
    assert.equal(decideModuleDrop('campus', 'campuses'), 'accept');
    assert.equal(decideModuleDrop('campus', 'internships'), 'reject-category');

    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: '校园稿',
    });
    const placement = await json<{
      section: string;
      snapshot: { title: string; category: string };
    }>('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'campuses',
      moduleId: mod.id,
    });
    assert.equal(placement.section, 'campuses');
    assert.equal(placement.snapshot.category, 'campus');
    assert.equal(placement.snapshot.title, '学生会外联部');
  });

  it('creates custom section and places custom module', async () => {
    const resume = await json<{
      id: string;
      customSections: Array<{ id: string; title: string }>;
    }>('POST', '/api/resumes', { title: '自定义栏测试' });
    assert.deepEqual(resume.customSections, []);

    const section = await json<{ id: string; title: string; sortOrder: number }>(
      'POST',
      `/api/resumes/${resume.id}/custom-sections`,
      { title: '自我评价' },
    );
    assert.equal(section.title, '自我评价');
    assert.equal(section.sortOrder, 0);

    const mod = await json<{ id: string }>('POST', '/api/modules', {
      category: 'custom',
      title: '开朗认真',
      body: '善于沟通',
      timeRange: '2024',
    });

    assert.equal(
      decideModuleDrop('custom', section.id, [section.id]),
      'accept',
    );
    assert.equal(decideModuleDrop('custom', 'projects'), 'reject-section');

    const placement = await json<{ section: string }>(
      'POST',
      `/api/resumes/${resume.id}/placements`,
      { section: section.id, moduleId: mod.id },
    );
    assert.equal(placement.section, section.id);

    const after = await json<{
      customSections: Array<{ title: string }>;
      placements: Array<{ section: string }>;
    }>('GET', `/api/resumes/${resume.id}`);
    assert.equal(after.customSections[0]?.title, '自我评价');
    assert.equal(after.placements[0]?.section, section.id);
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
