import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideModuleDrop,
  educationTimeRange,
  emptyEducationItem,
  emptySkillBlock,
  isPlaceableSection,
  validateProfileRequired,
} from './index.js';

describe('profile required fields', () => {
  it('rejects missing identity fields', () => {
    assert.equal(validateProfileRequired({}).ok, false);
    assert.equal(
      validateProfileRequired({
        name: '张三',
        gender: '男',
        email: 'a@b.com',
        phone: '138',
      }).ok,
      false,
    );
  });

  it('accepts complete identity', () => {
    const r = validateProfileRequired({
      name: '张三',
      gender: '女',
      email: 'a@b.com',
      phone: '13800000000',
      wechat: 'wx_zhang',
    });
    assert.equal(r.ok, true);
  });

  it('rejects invalid gender', () => {
    const r = validateProfileRequired({
      name: '张三',
      gender: '其他',
      email: 'a@b.com',
      phone: '138',
      wechat: 'wx',
    });
    assert.equal(r.ok, false);
  });
});

describe('education helpers', () => {
  it('formats time range from date pickers', () => {
    assert.equal(
      educationTimeRange('2023-09-01', '2027-06-30'),
      '2023.09 - 2027.06',
    );
    assert.equal(educationTimeRange('2026-01', undefined), '2026.01');
  });

  it('empty education/skill defaults', () => {
    assert.equal(emptyEducationItem().degree, '本科');
    assert.equal(emptySkillBlock().title, '');
  });
});

describe('skills not placeable', () => {
  it('rejects skill drops and skills section', () => {
    assert.equal(isPlaceableSection('skills'), false);
    assert.equal(decideModuleDrop('skill', 'skills'), 'reject-section');
    assert.equal(decideModuleDrop('project', 'projects'), 'accept');
  });
});
