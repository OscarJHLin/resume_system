import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canMovePlacement,
  movePlacementId,
} from './features/editor/placementOrder.js';
import { statusLine, workbenchBanner } from './features/workbench/workbenchState.js';

describe('S4 placement order helpers', () => {
  it('moves placement up/down within section order', () => {
    const ids = ['a', 'b', 'c'];
    assert.deepEqual(movePlacementId(ids, 'b', 'up'), ['b', 'a', 'c']);
    assert.deepEqual(movePlacementId(ids, 'b', 'down'), ['a', 'c', 'b']);
  });

  it('blocks moves at boundaries', () => {
    const ids = ['a', 'b'];
    assert.equal(movePlacementId(ids, 'a', 'up'), null);
    assert.equal(movePlacementId(ids, 'b', 'down'), null);
    assert.equal(canMovePlacement(ids, 'a', 'up'), false);
    assert.equal(canMovePlacement(ids, 'a', 'down'), true);
    assert.equal(movePlacementId(ids, 'missing', 'up'), null);
  });
});

describe('S4 workbench empty/error banners', () => {
  it('prioritizes connection error', () => {
    const b = workbenchBanner({
      connection: 'error',
      hasResume: false,
      placementCount: 0,
      libraryCount: 0,
    });
    assert.equal(b?.tone, 'error');
    assert.match(b?.message ?? '', /dev:server/);
  });

  it('warns when no resume after connect', () => {
    const b = workbenchBanner({
      connection: 'ok',
      hasResume: false,
      placementCount: 0,
      libraryCount: 3,
    });
    assert.equal(b?.tone, 'warn');
    assert.match(b?.message ?? '', /选择简历模板/);
  });

  it('info when resume has no placements', () => {
    const b = workbenchBanner({
      connection: 'ok',
      hasResume: true,
      placementCount: 0,
      libraryCount: 2,
    });
    assert.equal(b?.tone, 'info');
    assert.match(b?.message ?? '', /为空/);
  });

  it('hides banner when resume has placements', () => {
    const b = workbenchBanner({
      connection: 'ok',
      hasResume: true,
      placementCount: 2,
      libraryCount: 4,
    });
    assert.equal(b, null);
  });

  it('formats status line', () => {
    assert.equal(statusLine('S4', '就绪'), 'S4 · 就绪');
  });
});
