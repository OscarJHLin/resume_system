import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placementDisplayFields } from './features/canvas/placementDisplay.js';

describe('placementDisplayFields', () => {
  it('keeps both subtitle and projectType visible for projects', () => {
    const v = placementDisplayFields(
      {
        sourceModuleId: 'm1',
        category: 'project',
        title: '示例项目',
        subtitle: '负责人',
        projectType: 'Flutter',
        timeRange: '2025',
        body: '一行\n二行',
        tags: [],
        snapshottedAt: '2026-01-01T00:00:00.000Z',
      },
      'projects',
    );
    assert.equal(v.title, '示例项目');
    assert.match(v.middle, /Flutter/);
    assert.match(v.middle, /负责人/);
    assert.equal(v.timeRange, '2025');
    assert.deepEqual(v.bodyLines, ['一行', '二行']);
    for (const line of v.bodyLines) {
      assert.ok(!line.startsWith('•'));
      assert.ok(!/^[一二三四五六七八九十\d]+[、.]/.test(line));
    }
  });
});
