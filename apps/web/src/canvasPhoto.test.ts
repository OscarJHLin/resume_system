import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors ResumeCanvas show-photo gate. */
function shouldShowResumePhoto(profile: {
  id?: string;
  hasPhoto?: boolean;
} | null): boolean {
  return Boolean(profile?.hasPhoto && profile.id);
}

describe('resume canvas photo gate', () => {
  it('shows photo only when applied profile hasPhoto', () => {
    assert.equal(shouldShowResumePhoto(null), false);
    assert.equal(shouldShowResumePhoto({ id: 'a', hasPhoto: false }), false);
    assert.equal(shouldShowResumePhoto({ id: 'a', hasPhoto: true }), true);
    assert.equal(shouldShowResumePhoto({ hasPhoto: true }), false);
  });
});
