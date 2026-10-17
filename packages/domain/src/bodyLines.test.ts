import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { moduleBodyLines } from './index.js';

describe('moduleBodyLines', () => {
  it('splits only on newlines for projects', () => {
    assert.deepEqual(
      moduleBodyLines('负责A、负责B\n第二行', 'projects'),
      ['负责A、负责B', '第二行'],
    );
  });

  it('treats 、 as a line break for campuses', () => {
    assert.deepEqual(
      moduleBodyLines('负责赞助对接、活动策划、宣传推广', 'campuses'),
      ['负责赞助对接', '活动策划', '宣传推广'],
    );
  });

  it('keeps numbered markers like 1、 with the following clause', () => {
    assert.deepEqual(
      moduleBodyLines('1、负责外联、2、负责宣传', 'campuses'),
      ['1、负责外联', '2、负责宣传'],
    );
  });

  it('still honors newlines for campuses', () => {
    assert.deepEqual(
      moduleBodyLines('第一段、继续\n第二段', 'campuses'),
      ['第一段', '继续', '第二段'],
    );
  });
});
