import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildIsoDate,
  daysInMonth,
  formatIsoDateLabel,
  nextDateStep,
  parseIsoDateParts,
  yearOptions,
} from './features/library/stepDate.js';

describe('step date helpers', () => {
  it('parses and builds ISO dates', () => {
    assert.deepEqual(parseIsoDateParts('2024-07-01'), {
      year: 2024,
      month: 7,
      day: 1,
    });
    assert.equal(buildIsoDate(2024, 7, 1), '2024-07-01');
    assert.equal(buildIsoDate(null, 7, 1), '');
    assert.equal(parseIsoDateParts('').year, null);
    assert.equal(parseIsoDateParts('2024-02-30').year, null);
  });

  it('knows days in month including leap Feb', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(daysInMonth(2023, 2), 28);
    assert.equal(daysInMonth(2024, 4), 30);
  });

  it('lists years newest-first and advances steps', () => {
    const years = yearOptions(2026, 2, 1);
    assert.deepEqual(years, [2027, 2026, 2025, 2024]);
    assert.equal(nextDateStep('year'), 'month');
    assert.equal(nextDateStep('month'), 'day');
    assert.equal(nextDateStep('day'), 'closed');
  });

  it('formats Chinese label', () => {
    assert.equal(formatIsoDateLabel('2023-09-01'), '2023 年 9 月 1 日');
    assert.equal(formatIsoDateLabel(''), '选择日期');
  });
});
