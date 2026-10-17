import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './index.js';

describe('module CRUD from editor payloads', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-mod-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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

  it('creates with optional time/workstation empty then updates', async () => {
    const created = await json<{
      id: string;
      title: string;
      timeRange?: string;
      subtitle?: string;
      tags: string[];
    }>('POST', '/api/modules', {
      category: 'project',
      title: '新项目',
      body: '正文一行',
      tags: ['标签A'],
    });
    assert.equal(created.title, '新项目');
    assert.equal(created.timeRange, undefined);
    assert.deepEqual(created.tags, ['标签A']);

    const updated = await json<{
      title: string;
      subtitle?: string;
      projectType?: string;
      timeRange?: string;
    }>('PUT', `/api/modules/${created.id}`, {
      category: 'project',
      title: '新项目',
      subtitle: '基础站X',
      projectType: '个人项目',
      timeRange: '2025.01.01 - 2026.03.01',
      body: '正文一行\n第二行',
      tags: ['标签A', 'Agent'],
    });
    assert.equal(updated.subtitle, '基础站X');
    assert.equal(updated.projectType, '个人项目');
    assert.equal(updated.timeRange, '2025.01.01 - 2026.03.01');

    const listed = await json<Array<{ id: string }>>(
      'GET',
      '/api/modules?tag=Agent',
    );
    assert.ok(listed.some((m) => m.id === created.id));
  });

  it('rejects create without title', async () => {
    const res = await fetch(`${baseUrl}/api/modules`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category: 'skill',
        title: '  ',
        body: 'x',
      }),
    });
    assert.equal(res.status, 400);
  });

  it('deletes module without touching resume placements (snapshot isolation)', async () => {
    const mod = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: '可删项目',
      body: '正文',
      tags: [],
    });
    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: '带快照',
    });
    const placement = await json<{
      id: string;
      snapshot: { title: string };
    }>('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'projects',
      moduleId: mod.id,
    });
    assert.equal(placement.snapshot.title, '可删项目');

    const del = await fetch(`${baseUrl}/api/modules/${mod.id}`, {
      method: 'DELETE',
    });
    assert.equal(del.status, 204);

    const gone = await fetch(`${baseUrl}/api/modules/${mod.id}`);
    assert.equal(gone.status, 404);

    const still = await json<{
      placements: Array<{ snapshot: { title: string } }>;
    }>('GET', `/api/resumes/${resume.id}`);
    assert.equal(still.placements.length, 1);
    assert.equal(still.placements[0]?.snapshot.title, '可删项目');
  });

  it('places latest module fields after update (temp DB)', async () => {
    const mod = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: '初版标题',
      body: '旧正文',
      subtitle: '旧职责',
      projectType: '旧栈',
      tags: [],
    });
    await json('PUT', `/api/modules/${mod.id}`, {
      category: 'project',
      title: '新标题',
      body: '新正文第一行\n第二行',
      subtitle: '新职责',
      projectType: 'Flutter',
      timeRange: '2025.01 - 2025.06',
      tags: [],
    });
    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: '验新鲜度',
    });
    const placement = await json<{
      snapshot: {
        title: string;
        body: string;
        subtitle?: string;
        projectType?: string;
        timeRange?: string;
        sourceModuleId: string;
      };
    }>('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'projects',
      moduleId: mod.id,
    });
    assert.equal(placement.snapshot.sourceModuleId, mod.id);
    assert.equal(placement.snapshot.title, '新标题');
    assert.equal(placement.snapshot.body, '新正文第一行\n第二行');
    assert.equal(placement.snapshot.subtitle, '新职责');
    assert.equal(placement.snapshot.projectType, 'Flutter');
    assert.equal(placement.snapshot.timeRange, '2025.01 - 2025.06');
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
