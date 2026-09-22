import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './index.js';

const FULL_PROFILE = {
  name: '有照片用户',
  gender: '女',
  email: 'photo@example.com',
  phone: '13900000000',
  wechat: 'wx_photo',
  education: [],
  skills: [],
  tags: [],
};

describe('profile photo storage (DOCX omits photo)', () => {
  let dbPath: string;
  let app: FastifyInstance;
  let baseUrl: string;

  before(async () => {
    dbPath = path.join(
      os.tmpdir(),
      `resume-photo-${Date.now()}-${Math.random().toString(16).slice(2)}.db`,
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
    const photos = path.join(path.dirname(dbPath), 'photos');
    if (fs.existsSync(photos)) {
      for (const f of fs.readdirSync(photos)) {
        fs.unlinkSync(path.join(photos, f));
      }
      fs.rmdirSync(photos);
    }
  });

  it('stores photo on profile card; export has no embedded image requirement', async () => {
    const profile = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(FULL_PROFILE),
    }).then(async (r) => {
      assert.equal(r.status, 201);
      return r.json() as Promise<{ id: string; hasPhoto: boolean }>;
    });

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const put = await fetch(`${baseUrl}/api/profiles/${profile.id}/photo`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataBase64: png.toString('base64'),
        mime: 'image/png',
      }),
    });
    assert.equal(put.status, 200);
    const updated = (await put.json()) as { hasPhoto: boolean };
    assert.equal(updated.hasPhoto, true);

    const get = await fetch(`${baseUrl}/api/profiles/${profile.id}/photo`);
    assert.equal(get.status, 200);
    assert.match(get.headers.get('content-type') ?? '', /image\/png/);

    const resume = await fetch(`${baseUrl}/api/resumes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '有照片卡', profileId: profile.id }),
    }).then((r) => r.json() as Promise<{ id: string }>);

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
  });

  it('accepts ~1.5MB base64 photo payloads (bodyLimit > Fastify default 1MB)', async () => {
    const profile = await fetch(`${baseUrl}/api/profiles`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...FULL_PROFILE,
        email: 'bigphoto@example.com',
        phone: '13900000001',
      }),
    }).then(async (r) => {
      assert.equal(r.status, 201);
      return r.json() as Promise<{ id: string }>;
    });

    // ~1.2MB binary → ~1.6MB JSON (exceeds old 1MB Fastify default)
    const raw = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(1_200_000, 0),
    ]);
    const put = await fetch(`${baseUrl}/api/profiles/${profile.id}/photo`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataBase64: raw.toString('base64'),
        mime: 'image/png',
      }),
    });
    assert.equal(put.status, 200);
    const updated = (await put.json()) as { hasPhoto: boolean };
    assert.equal(updated.hasPhoto, true);
  });
});
