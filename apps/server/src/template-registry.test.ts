import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { DEFAULT_TEMPLATE_ID } from '@resume/domain';
import {
  listTemplateMeta,
  loadTemplateRegistry,
  resetTemplateRegistryCache,
  resolveTemplatesDir,
} from './modules/template/registry.js';

describe('template pack registry', () => {
  it('loads blue-black-simple as 蓝黑简洁简历', () => {
    resetTemplateRegistryCache();
    const root = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../templates',
    );
    const map = loadTemplateRegistry(root);
    const def = map.get(DEFAULT_TEMPLATE_ID);
    assert.ok(def);
    assert.equal(def.displayName, '蓝黑简洁简历');
    assert.equal(def.slug, 'blue-black-simple');
    assert.equal(def.photoInTemplate, true);
    assert.equal(def.photo?.placement, 'above-name-center');
    assert.equal(def.layout.internshipTabCenter, 6520);
    assert.equal(def.styles.tagline.bold, true);
    assert.equal(def.styles.name.fontSizePt, 22);
    const meta = listTemplateMeta();
    assert.equal(meta[0]?.label, '蓝黑简洁简历');
    assert.ok(resolveTemplatesDir(root).endsWith('templates'));
  });
});
