import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_TEMPLATE_ID, validateProfileRequired } from '@resume/domain';
import { buildApp } from './index.js';

describe('profile cards + template select', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-profile-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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

  it('rejects incomplete profile and creates multiple cards', async () => {
    const bad = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '只有姓名' }),
    });
    assert.equal(bad.status, 400);

    const a = await json<{ id: string; name: string }>('POST', '/api/profiles', {
      name: '甲',
      gender: '男',
      email: 'a@x.com',
      phone: '111',
      wechat: 'wx_a',
      skills: [{ title: '语言', body: 'Python' }],
      tags: ['校招'],
      notes: '备注A',
    });
    const b = await json<{ id: string }>('POST', '/api/profiles', {
      name: '乙',
      gender: '女',
      email: 'b@x.com',
      phone: '222',
      wechat: 'wx_b',
    });
    const list = await json<Array<{ id: string }>>('GET', '/api/profiles');
    assert.ok(list.length >= 2);
    assert.ok(list.some((p) => p.id === a.id));
    assert.ok(list.some((p) => p.id === b.id));
  });

  it('copies profile fields and photo to a new card', async () => {
    const src = await json<{
      id: string;
      name: string;
      summary?: string;
      hasPhoto?: boolean;
    }>('POST', '/api/profiles', {
      name: '源卡',
      gender: '男',
      email: 'src@x.com',
      phone: '999',
      wechat: 'wx_src',
      summary: '应聘岗位',
      statement: '陈述',
      education: [
        {
          school: '示例大学',
          degree: '本科',
          major: '软件',
          startDate: '2020-09-01',
          endDate: '2024-06-01',
        },
      ],
      skills: [{ title: '语言', body: 'TS' }],
      tags: ['副本测'],
      notes: '源备注',
    });

    const pngB64 =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const withPhoto = await json<{ id: string; hasPhoto?: boolean }>(
      'PUT',
      `/api/profiles/${src.id}/photo`,
      { dataBase64: pngB64, mime: 'image/png' },
    );
    assert.equal(withPhoto.hasPhoto, true);

    const copy = await json<{
      id: string;
      name: string;
      summary?: string;
      statement?: string;
      notes?: string;
      hasPhoto?: boolean;
      education: Array<{ school: string }>;
    }>('POST', `/api/profiles/${src.id}/copy`);

    assert.notEqual(copy.id, src.id);
    assert.equal(copy.name, '源卡（副本）');
    assert.equal(copy.summary, '应聘岗位');
    assert.equal(copy.statement, '陈述');
    assert.equal(copy.notes, '源备注');
    assert.equal(copy.hasPhoto, true);
    assert.equal(copy.education[0]?.school, '示例大学');

    const origPhoto = await fetch(`${baseUrl}/api/profiles/${src.id}/photo`);
    const copyPhoto = await fetch(`${baseUrl}/api/profiles/${copy.id}/photo`);
    assert.equal(origPhoto.status, 200);
    assert.equal(copyPhoto.status, 200);
    const origBuf = Buffer.from(await origPhoto.arrayBuffer());
    const copyBuf = Buffer.from(await copyPhoto.arrayBuffer());
    assert.deepEqual(origBuf, copyBuf);

    const still = await json<{ name: string }>('GET', `/api/profiles/${src.id}`);
    assert.equal(still.name, '源卡');

    const missing = await fetch(`${baseUrl}/api/profiles/no-such/copy`, {
      method: 'POST',
    });
    assert.equal(missing.status, 404);
  });

  it('template select creates empty lin-v1 resume; apply profile fills export', async () => {
    const templates = await json<Array<{ id: string }>>('GET', '/api/templates');
    assert.equal(templates[0]?.id, DEFAULT_TEMPLATE_ID);

    const resume = await json<{
      id: string;
      profileId: string;
      templateId: string;
      placements: unknown[];
    }>('POST', '/api/resumes', {
      title: '示例模板稿',
      templateId: DEFAULT_TEMPLATE_ID,
    });
    assert.equal(resume.templateId, DEFAULT_TEMPLATE_ID);
    assert.equal(resume.profileId, '');
    assert.equal(resume.placements.length, 0);

    const profile = await json<{ id: string; statement?: string }>(
      'POST',
      '/api/profiles',
      {
      name: '候选人',
      gender: '男',
      email: 'c@x.com',
      phone: '333',
      wechat: 'wx_c',
      summary: '软件工程本科生',
      statement: '优势一\n优势二',
      education: [
        {
          school: '示例学院',
          degree: '本科',
          major: '软件工程',
          startDate: '2023-09-01',
          endDate: '2027-06-01',
          gpa: '3.57',
          rank: '专业前 5%',
        },
      ],
      skills: [
        { title: '编程语言', body: 'Python、Dart' },
        { title: '工程工具', body: 'Git、Docker' },
      ],
    });
    assert.equal(profile.statement, '优势一\n优势二');

    const applied = await json<{ profileId: string }>(
      'PATCH',
      `/api/resumes/${resume.id}`,
      { profileId: profile.id },
    );
    assert.equal(applied.profileId, profile.id);

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
  });

  it('domain validateProfileRequired is strict', () => {
    assert.equal(validateProfileRequired({ name: 'x' }).ok, false);
    assert.equal(
      validateProfileRequired({
        name: 'x',
        gender: '男',
        email: 'e',
        phone: 'p',
        wechat: 'w',
      }).ok,
      true,
    );
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
