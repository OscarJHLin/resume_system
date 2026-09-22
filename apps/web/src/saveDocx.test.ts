import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirror of saveDocx name normalization for unit test without DOM. */
function normalizeDocxName(suggested: string): string {
  const safe =
    suggested.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'resume.docx';
  return safe.toLowerCase().endsWith('.docx') ? safe : `${safe}.docx`;
}

describe('saveDocx filename', () => {
  it('ensures .docx and strips path chars', () => {
    assert.equal(normalizeDocxName('我的简历'), '我的简历.docx');
    assert.equal(normalizeDocxName('a/b:c.docx'), 'a_b_c.docx');
  });
});
