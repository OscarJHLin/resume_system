import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import { buildApp } from './index.js';
import { renderToIR } from './modules/template/index.js';
import { exportDocx } from './modules/export/index.js';

const FULL_PROFILE = {
  name: '测试用户',
  gender: '男',
  email: 'test@example.com',
  phone: '13800000000',
  wechat: 'wx_test',
  education: [
    {
      school: '示例大学',
      degree: '本科',
      major: '计算机',
      startDate: '2018-09-01',
      endDate: '2022-06-30',
      gpa: '3.5',
      rank: '专业前 10%',
    },
  ],
  skills: [{ title: '编程语言', body: 'TypeScript、Python' }],
  tags: ['求职'],
};

describe('S1 resume assembly', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-s1-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
    );
    const built = buildApp(dbPath);
    app = await built.start();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const addr = app.server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('expected TCP address');
    }
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

  it('snapshots placements so library edits do not mutate resume', async () => {
    const profile = await json<{ id: string }>('POST', '/api/profiles', FULL_PROFILE);

    const mod = await json<{ id: string }>('POST', '/api/modules', {
      category: 'project',
      title: '原始标题',
      subtitle: '基础站A',
      projectType: '个人项目',
      timeRange: '2023.01 - 2024.06',
      body: '原始正文第一行\n第二行',
      tags: ['React', '后端'],
    });

    const resume = await json<{ id: string }>('POST', '/api/resumes', {
      title: '投递稿A',
      profileId: profile.id,
      templateId: DEFAULT_TEMPLATE_ID,
    });

    const placement = await json<{
      id: string;
      snapshot: { title: string; body: string; tags: string[] };
    }>('POST', `/api/resumes/${resume.id}/placements`, {
      section: 'projects',
      moduleId: mod.id,
    });

    assert.equal(placement.snapshot.title, '原始标题');
    assert.equal(placement.snapshot.body, '原始正文第一行\n第二行');
    assert.deepEqual(placement.snapshot.tags, ['React', '后端']);

    await json('PUT', `/api/modules/${mod.id}`, {
      category: 'project',
      title: '已修改标题',
      subtitle: '基础站B',
      projectType: '团队项目',
      timeRange: '2024.01 - 2025.01',
      body: '库内已改写',
      tags: ['Vue'],
    });

    const updatedMod = await json<{ title: string; body: string }>(
      'GET',
      `/api/modules/${mod.id}`,
    );
    assert.equal(updatedMod.title, '已修改标题');
    assert.equal(updatedMod.body, '库内已改写');

    const resumeAfter = await json<{
      placements: Array<{ snapshot: { title: string; body: string; tags: string[] } }>;
    }>('GET', `/api/resumes/${resume.id}`);

    assert.equal(resumeAfter.placements.length, 1);
    assert.equal(resumeAfter.placements[0]?.snapshot.title, '原始标题');
    assert.equal(
      resumeAfter.placements[0]?.snapshot.body,
      '原始正文第一行\n第二行',
    );
    assert.deepEqual(resumeAfter.placements[0]?.snapshot.tags, [
      'React',
      '后端',
    ]);
  });

  it('rejects skill placement and incompatible category/section; exports docx', async () => {
    const skill = await json<{ id: string }>('POST', '/api/modules', {
      category: 'skill',
      title: 'TypeScript',
      body: '熟悉类型系统',
      tags: ['TS'],
    });

    const resumes = await json<Array<{ id: string }>>('GET', '/api/resumes');
    const resumeId = resumes[0]?.id;
    assert.ok(resumeId);

    const badSkillSection = await fetch(
      `${baseUrl}/api/resumes/${resumeId}/placements`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section: 'skills', moduleId: skill.id }),
      },
    );
    assert.equal(badSkillSection.status, 400);

    const bad = await fetch(`${baseUrl}/api/resumes/${resumeId}/placements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ section: 'projects', moduleId: skill.id }),
    });
    assert.equal(bad.status, 400);

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resumeId}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    assert.ok(buf.length > 0, 'docx buffer should be non-empty');
    assert.equal(buf[0], 0x50);
    assert.equal(buf[1], 0x4b);
  });

  it('renderToIR maps profile skills + structured project fields', () => {
    const ir = renderToIR(
      {
        templateId: DEFAULT_TEMPLATE_ID,
        profile: {
          id: 'p1',
          name: '张三',
          gender: '男',
          phone: '13800000000',
          email: 'z@example.com',
          wechat: 'wx_z',
          education: [
            {
              id: 'e1',
              school: '示例大学',
              degree: '本科',
              timeRange: '2018-2022',
            },
          ],
          skills: [{ id: 's1', title: '编程语言', body: 'TypeScript' }],
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
        placements: [
          {
            id: 'pl1',
            section: 'projects',
            sortOrder: 0,
            snapshot: {
              sourceModuleId: 'm1',
              category: 'project',
              title: '简历系统',
              subtitle: '个人项目',
              projectType: '全栈',
              timeRange: '2026.01 - 2026.09',
              body: '行一\n行二',
              tags: ['TS'],
              snapshottedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      },
      () => '2026-09-23T00:00:00.000Z',
    );

    assert.equal(ir.templateId, DEFAULT_TEMPLATE_ID);
    const name = ir.blocks.find((b) => b.kind === 'heading' && b.level === 1);
    assert.ok(name && name.kind === 'heading');
    assert.equal(name.runs[0]?.text, '张三');

    const skill = ir.blocks.find(
      (b) =>
        b.kind === 'paragraph' &&
        b.runs[0]?.text === '编程语言：' &&
        b.runs[1]?.text === 'TypeScript',
    );
    assert.ok(skill);
    assert.equal(skill.kind === 'paragraph' && skill.bullet, false);

    const titlePara = ir.blocks.find(
      (b) =>
        b.kind === 'paragraph' &&
        b.runs.some((r) => r.text === '简历系统' && r.style?.bold),
    );
    assert.ok(titlePara);
  });

  it('exportDocx produces zip/docx bytes from IR', async () => {
    const ir = renderToIR({
      templateId: DEFAULT_TEMPLATE_ID,
      profile: {
        id: 'p1',
        name: '李四',
        education: [],
        skills: [],
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      placements: [],
    });
    const buf = await exportDocx(ir);
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
    assert.ok(
      res.ok,
      `${method} ${urlPath} -> ${res.status}: ${text}`,
    );
    if (res.status === 204 || text === '') {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }
});
