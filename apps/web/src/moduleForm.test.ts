import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyForm,
  moduleToForm,
  parseTagsText,
  validateModuleForm,
} from './features/library/moduleForm.js';
import {
  formatTimeRange,
  parseTimeRange,
  validateTimeRangeParts,
} from './features/library/timeRange.js';

describe('module form timeRange helpers', () => {
  it('formats optional start/end dates with dots', () => {
    assert.equal(formatTimeRange({ start: '', end: '' }), undefined);
    assert.equal(
      formatTimeRange({ start: '2023-09-01', end: '' }),
      '2023.09.01',
    );
    assert.equal(
      formatTimeRange({ start: '2023-09-01', end: '2027-06-30' }),
      '2023.09.01 - 2027.06.30',
    );
  });

  it('parses stored ranges back to date inputs', () => {
    assert.deepEqual(parseTimeRange('2024.07'), {
      start: '2024-07-01',
      end: '',
    });
    assert.deepEqual(parseTimeRange('2023.09.01 - 2027.06.30'), {
      start: '2023-09-01',
      end: '2027-06-30',
    });
  });

  it('rejects inverted ranges', () => {
    assert.match(
      validateTimeRangeParts({
        start: '2025-01-01',
        end: '2024-01-01',
      }) ?? '',
      /不能晚于/,
    );
  });
});

describe('module form validation', () => {
  it('requires title; allows empty optional fields', () => {
    const bad = validateModuleForm(emptyForm('project'));
    assert.equal(bad.ok, false);

    const good = validateModuleForm({
      ...emptyForm('project'),
      title: '示例记忆',
      body: '语义检索',
      tagsText: 'AI, Agent',
    });
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.payload.subtitle, undefined);
      assert.equal(good.payload.projectType, undefined);
      assert.equal(good.payload.timeRange, undefined);
      assert.deepEqual(good.payload.tags, ['AI', 'Agent']);
    }
  });

  it('maps workstation to subtitle and dates to timeRange', () => {
    const r = validateModuleForm({
      category: 'project',
      title: '示例项目',
      workstation: '家庭实验室',
      projectType: 'Flutter',
      timeStart: '2025-01-01',
      timeEnd: '2026-03-01',
      body: '五层空间模型',
      tagsText: 'Flutter\nDrift',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.subtitle, '家庭实验室');
      assert.equal(r.payload.projectType, 'Flutter');
      assert.equal(r.payload.timeRange, '2025.01.01 - 2026.03.01');
      assert.deepEqual(r.payload.tags, ['Flutter', 'Drift']);
    }
  });

  it('round-trips module → form → payload for edit', () => {
    const form = moduleToForm({
      id: 'm1',
      category: 'internship',
      title: '示例教育科技',
      subtitle: '示例市',
      projectType: '实习助理',
      timeRange: '2024.07.01',
      body: '展会执行',
      tags: ['实习'],
      createdAt: '',
      updatedAt: '',
    });
    assert.equal(form.timeStart, '2024-07-01');
    const r = validateModuleForm(form);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.title, '示例教育科技');
      assert.equal(r.payload.subtitle, '示例市');
    }
  });

  it('parses tags from commas and newlines', () => {
    assert.deepEqual(parseTagsText('a, b，c\nd'), ['a', 'b', 'c', 'd']);
  });
});
