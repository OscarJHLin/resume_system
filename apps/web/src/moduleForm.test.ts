import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyForm,
  moduleToForm,
  parseTagsText,
  validateModuleForm,
} from './features/library/moduleForm.js';
import {
  formatTimePoint,
  formatTimeRange,
  parseTimePoint,
  parseTimeRange,
  validateTimeRangeParts,
} from './features/library/timeRange.js';

describe('module form timeRange helpers', () => {
  it('formats optional start/end dates with dots', () => {
    assert.equal(formatTimeRange({ start: '', end: '' }), undefined);
    assert.equal(
      formatTimeRange({ start: '2023-09-01', end: '' }),
      '2023.09.01 - 至今',
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
    assert.deepEqual(parseTimeRange('2023.09.01 - 至今'), {
      start: '2023-09-01',
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

  it('formats award time as a single date point', () => {
    assert.equal(formatTimePoint(''), undefined);
    assert.equal(formatTimePoint('2025-06-01'), '2025.06.01');
    assert.equal(parseTimePoint('2025.06.01'), '2025-06-01');
    assert.equal(parseTimePoint('2025.06.01 - 至今'), '2025-06-01');
  });
});

describe('award form uses time point', () => {
  it('saves award time without 至今', () => {
    const r = validateModuleForm({
      ...emptyForm('award'),
      title: '优秀学生干部',
      timeStart: '2024-05-20',
      body: '',
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.timeRange, '2024.05.20');
      assert.doesNotMatch(r.payload.timeRange ?? '', /至今/);
    }
  });

  it('loads legacy award range into a single date', () => {
    const form = moduleToForm({
      id: 'a1',
      category: 'award',
      title: '旧奖项',
      timeRange: '2023.09.01 - 至今',
      body: '',
      tags: [],
      createdAt: '',
      updatedAt: '',
    });
    assert.equal(form.timeStart, '2023-09-01');
    assert.equal(form.timeEnd, '');
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
