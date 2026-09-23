import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bannerVisible,
  compareVersions,
  initialUpdateState,
  isNewer,
  progressPercent,
  updateReducer,
  type UpdateAction,
  type UpdateInfo,
  type UpdateState,
} from './features/updater/updateState';

const newer: UpdateInfo = {
  available: true,
  currentVersion: '1.5.3',
  version: '1.6.0',
  notes: '- 应用内更新',
  date: '2026-09-23T00:00:00Z',
};
const latest: UpdateInfo = { available: false, currentVersion: '1.6.0' };

function run(actions: UpdateAction[], from: UpdateState = initialUpdateState) {
  return actions.reduce(updateReducer, from);
}

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
    assert.equal(compareVersions('1.5.3', '1.5.3'), 0);
    assert.equal(compareVersions('v1.5.3', '1.5.4'), -1);
    assert.equal(compareVersions('2.0', '1.99.99'), 1);
    assert.equal(compareVersions('1.6.0-beta.1', '1.6.0'), 0);
  });

  it('isNewer guards against stale / equal manifests', () => {
    assert.equal(isNewer(newer), true);
    assert.equal(isNewer({ ...newer, version: '1.5.3' }), false);
    assert.equal(isNewer({ ...newer, version: '1.5.2' }), false);
    assert.equal(isNewer(latest), false);
  });
});

describe('updateReducer', () => {
  it('silent startup check with no update stays hidden', () => {
    const s = run([
      { type: 'check-start', manual: false },
      { type: 'check-result', info: latest, manual: false },
    ]);
    assert.equal(s.phase, 'idle');
    assert.equal(bannerVisible(s), false);
  });

  it('manual check with no update shows「已是最新版本」then clears', () => {
    const s = run([
      { type: 'check-start', manual: true },
      { type: 'check-result', info: latest, manual: true },
    ]);
    assert.equal(s.phase, 'latest');
    assert.equal(bannerVisible(s), true);
    assert.equal(updateReducer(s, { type: 'clear-latest' }).phase, 'idle');
  });

  it('background event shows banner; 稍后 hides that version until manual check', () => {
    let s = run([{ type: 'available-event', info: newer }]);
    assert.equal(s.phase, 'available');
    s = run([{ type: 'dismiss' }], s);
    assert.equal(s.phase, 'idle');
    assert.equal(s.dismissedVersion, '1.6.0');
    s = run([{ type: 'available-event', info: newer }], s);
    assert.equal(s.phase, 'idle');
    s = run(
      [
        { type: 'check-start', manual: true },
        { type: 'check-result', info: newer, manual: true },
      ],
      s,
    );
    assert.equal(s.phase, 'available');
  });

  it('a newer version than the dismissed one re-shows the banner', () => {
    const s = run([
      { type: 'available-event', info: newer },
      { type: 'dismiss' },
      { type: 'available-event', info: { ...newer, version: '1.7.0' } },
    ]);
    assert.equal(s.phase, 'available');
  });

  it('install: progress → restarting; failure → error with install retry', () => {
    let s = run([
      { type: 'available-event', info: newer },
      { type: 'install-start' },
      { type: 'progress', downloaded: 50, total: 200 },
    ]);
    assert.equal(s.phase, 'downloading');
    assert.equal(progressPercent(s.downloaded, s.total), 25);
    const done = run([{ type: 'progress', downloaded: 200, total: 200 }], s);
    assert.equal(done.phase, 'restarting');

    s = run([{ type: 'install-failed', message: 'signature mismatch' }], s);
    assert.equal(s.phase, 'error');
    assert.equal(s.errorDuring, 'install');
    s = run([{ type: 'install-start' }], s);
    assert.equal(s.phase, 'downloading');
    assert.equal(s.downloaded, 0);
  });

  it('ignores checks and dismiss while downloading', () => {
    const s = run([
      { type: 'available-event', info: newer },
      { type: 'install-start' },
      { type: 'check-start', manual: true },
      { type: 'check-result', info: latest, manual: true },
      { type: 'dismiss' },
    ]);
    assert.equal(s.phase, 'downloading');
  });

  it('install-start is a no-op without a newer version', () => {
    assert.equal(run([{ type: 'install-start' }]).phase, 'idle');
  });

  it('silent check failure stays hidden; manual failure shows retryable error', () => {
    const silent = run([
      { type: 'check-start', manual: false },
      { type: 'check-failed', message: 'offline', manual: false },
    ]);
    assert.equal(bannerVisible(silent), false);
    const manual = run([
      { type: 'check-start', manual: true },
      { type: 'check-failed', message: 'offline', manual: true },
    ]);
    assert.equal(manual.phase, 'error');
    assert.equal(manual.errorDuring, 'check');
  });

  it('silent re-check with no update keeps an open banner', () => {
    const s = run([
      { type: 'available-event', info: newer },
      { type: 'check-result', info: latest, manual: false },
    ]);
    assert.equal(s.phase, 'available');
  });

  it('progressPercent handles unknown total', () => {
    assert.equal(progressPercent(10, null), null);
    assert.equal(progressPercent(10, 0), null);
    assert.equal(progressPercent(300, 200), 100);
  });
});
