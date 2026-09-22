import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyProfileForm,
  validateProfileForm,
} from './features/library/profileForm.js';

describe('profile form validation', () => {
  it('requires identity fields', () => {
    const r = validateProfileForm(emptyProfileForm());
    assert.equal(r.ok, false);
  });

  it('accepts complete card and keeps education/skills', () => {
    const form = emptyProfileForm();
    form.name = '测试';
    form.gender = '男';
    form.email = 't@x.com';
    form.phone = '138';
    form.wechat = 'wx';
    form.education[0] = {
      id: '',
      school: '示例大学',
      degree: '本科',
      major: '软件工程',
      startDate: '2023-09-01',
      endDate: '2027-06-01',
      gpa: '3.5',
      rank: '专业前 5%',
    };
    form.skills[0] = { id: '', title: '编程语言', body: 'Python' };
    form.statement = '优势陈述一行';
    form.tagsText = '校招, 全栈';
    const r = validateProfileForm(form);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.payload.education?.length, 1);
      assert.equal(r.payload.skills?.[0]?.title, '编程语言');
      assert.equal(r.payload.statement, '优势陈述一行');
      assert.deepEqual(r.payload.tags, ['校招', '全栈']);
    }
  });
});
