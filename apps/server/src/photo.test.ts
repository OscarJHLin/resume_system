import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import { buildApp } from './index.js';
import { exportDocx } from './modules/export/index.js';
import { renderToIR } from './modules/template/index.js';

describe('profile photo upload + DOCX embed', () => {
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

  it('stores photo on disk and serves it; export includes image', async () => {
    // 1x1 png
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const put = await fetch(`${baseUrl}/api/profile/photo`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        dataBase64: png.toString('base64'),
        mime: 'image/png',
      }),
    });
    assert.equal(put.status, 200);
    const profile = (await put.json()) as { hasPhoto: boolean };
    assert.equal(profile.hasPhoto, true);

    const get = await fetch(`${baseUrl}/api/profile/photo`);
    assert.equal(get.status, 200);
    assert.match(get.headers.get('content-type') ?? '', /image\/png/);

    const resume = await fetch(`${baseUrl}/api/resumes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '有照片' }),
    }).then((r) => r.json() as Promise<{ id: string }>);

    const exportRes = await fetch(
      `${baseUrl}/api/resumes/${resume.id}/export`,
      { method: 'POST' },
    );
    assert.equal(exportRes.status, 200);
    const buf = Buffer.from(await exportRes.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString(), 'PK');
    assert.ok(buf.length > 2000);

    // unit: exportDocx with photo option produces larger zip than without
    const ir = renderToIR({
      templateId: DEFAULT_TEMPLATE_ID,
      profile: {
        id: 'p',
        name: '测',
        education: [],
        updatedAt: '',
      },
      placements: [],
    });
    const withPhoto = await exportDocx(ir, {
      photo: { buffer: png, mime: 'image/png' },
    });
    const without = await exportDocx(ir);
    assert.ok(withPhoto.length > without.length);
  });
});
