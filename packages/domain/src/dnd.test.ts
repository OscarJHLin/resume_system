import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideModuleDrop,
  parseModuleDragPayload,
  serializeModuleDragPayload,
} from './index.js';

describe('domain drag/drop contracts', () => {
  it('round-trips module drag payload', () => {
    const raw = serializeModuleDragPayload({
      moduleId: 'm1',
      category: 'project',
    });
    assert.deepEqual(parseModuleDragPayload(raw), {
      moduleId: 'm1',
      category: 'project',
    });
  });

  it('rejects malformed drag payloads', () => {
    assert.equal(parseModuleDragPayload(''), null);
    assert.equal(parseModuleDragPayload('{}'), null);
    assert.equal(
      parseModuleDragPayload(JSON.stringify({ moduleId: 'x', category: 'nope' })),
      null,
    );
  });

  it('decides section/category compatibility for DnD', () => {
    assert.equal(decideModuleDrop('project', 'projects'), 'accept');
    assert.equal(decideModuleDrop('skill', 'projects'), 'reject-category');
    assert.equal(decideModuleDrop('skill', 'basic'), 'reject-section');
    assert.equal(decideModuleDrop('skill', 'skills'), 'reject-section');
    assert.equal(decideModuleDrop('award', 'awards'), 'accept');
  });

  it('allows custom modules only on custom section ids', () => {
    const customId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    assert.equal(decideModuleDrop('custom', customId), 'accept');
    assert.equal(decideModuleDrop('custom', 'projects'), 'reject-section');
    assert.equal(
      decideModuleDrop('custom', customId, ['ffffffff-0000-1111-2222-333333333333']),
      'reject-section',
    );
    assert.equal(decideModuleDrop('custom', customId, [customId]), 'accept');
    assert.equal(decideModuleDrop('project', customId), 'reject-section');
  });
});
