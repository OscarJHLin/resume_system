import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  deleteModuleConfirmMessage,
  deleteProfileConfirmMessage,
} from './features/library/libraryDelete.js';

describe('libraryDelete confirms', () => {
  it('module message mentions snapshot keep', () => {
    const msg = deleteModuleConfirmMessage('示例项目');
    assert.match(msg, /示例项目/);
    assert.match(msg, /快照/);
  });

  it('profile message warns when applied', () => {
    assert.match(deleteProfileConfirmMessage('张三', true), /清空/);
    assert.doesNotMatch(deleteProfileConfirmMessage('张三', false), /清空/);
  });
});
