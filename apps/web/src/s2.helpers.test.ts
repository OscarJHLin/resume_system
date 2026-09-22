import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildModulesQuery } from './api/client.js';
import { dropZoneClassName } from './features/dnd/dragPayload.js';

describe('web S2 helpers', () => {
  it('builds modules query for tag/category/q filters', () => {
    assert.equal(buildModulesQuery({}), '/api/modules');
    assert.equal(
      buildModulesQuery({ tag: 'React', category: 'project' }),
      '/api/modules?category=project&tag=React',
    );
    assert.equal(
      buildModulesQuery({ q: '简历' }),
      `/api/modules?q=${encodeURIComponent('简历')}`,
    );
  });

  it('composes drop zone class names', () => {
    assert.equal(
      dropZoneClassName('editor__drop', { active: false, invalid: false }),
      'editor__drop',
    );
    assert.equal(
      dropZoneClassName('editor__drop', { active: true, invalid: false }),
      'editor__drop editor__drop--active',
    );
    assert.equal(
      dropZoneClassName('editor__drop', { active: true, invalid: true }),
      'editor__drop editor__drop--active editor__drop--invalid',
    );
  });
});
