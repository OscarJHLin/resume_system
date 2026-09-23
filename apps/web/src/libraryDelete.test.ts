import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deleteModuleConfirmMessage,
  deleteModuleConfirmTitle,
  deleteProfileConfirmMessage,
  deleteProfileConfirmTitle,
} from './features/library/libraryDelete.js';

describe('libraryDelete confirms', () => {
  it('module message mentions snapshot keep', () => {
    const msg = deleteModuleConfirmMessage('示例项目');
    assert.match(msg, /示例项目/);
    assert.match(msg, /快照/);
    assert.equal(deleteModuleConfirmTitle(), '删除模块');
  });

  it('profile message warns when applied', () => {
    assert.match(deleteProfileConfirmMessage('张三', true), /清空/);
    assert.doesNotMatch(deleteProfileConfirmMessage('张三', false), /清空/);
    assert.equal(deleteProfileConfirmTitle(), '删除基本信息');
  });
});
