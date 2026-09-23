import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  armPointerPick,
  beginModuleDrag,
  clearPointerPick,
  consumePointerPick,
  endModuleDrag,
  getActiveModuleDrag,
  getPlacePayload,
  getPointerPick,
  MODULE_DRAG_END_GRACE_MS,
  scheduleEndModuleDrag,
  subscribePlaceSession,
} from './features/dnd/dragSession.js';
import { readModuleDragData } from './features/dnd/dragPayload.js';

describe('drag session lifecycle', () => {
  it('keeps payload after scheduled dragend until grace elapses', async () => {
    beginModuleDrag({ moduleId: 'm1', category: 'project' });
    assert.deepEqual(getActiveModuleDrag(), {
      moduleId: 'm1',
      category: 'project',
    });
    scheduleEndModuleDrag(40);
    // Immediately after dragend schedule, drop can still read.
    assert.deepEqual(getPlacePayload()?.moduleId, 'm1');
    assert.deepEqual(readModuleDragData(null)?.moduleId, 'm1');
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(getActiveModuleDrag()?.moduleId, 'm1');
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(getActiveModuleDrag(), null);
  });

  it('drop-style endModuleDrag wins over a pending dragend timer', async () => {
    beginModuleDrag({ moduleId: 'm2', category: 'internship' });
    scheduleEndModuleDrag(80);
    // Drop consumes session before the timer.
    assert.equal(readModuleDragData(null)?.moduleId, 'm2');
    endModuleDrag();
    assert.equal(getActiveModuleDrag(), null);
    await new Promise((r) => setTimeout(r, 100));
    // Stale timer must not resurrect or throw; session stays clear.
    assert.equal(getActiveModuleDrag(), null);
  });

  it('endModuleDrag clears immediately for successful drop', () => {
    beginModuleDrag({ moduleId: 'm3', category: 'internship' });
    endModuleDrag();
    assert.equal(getActiveModuleDrag(), null);
  });

  it('newer begin invalidates a pending end timer from a prior drag', async () => {
    beginModuleDrag({ moduleId: 'old', category: 'project' });
    scheduleEndModuleDrag(30);
    beginModuleDrag({ moduleId: 'new', category: 'award' });
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(getActiveModuleDrag()?.moduleId, 'new');
    endModuleDrag();
  });

  it('beginModuleDrag does not notify place subscribers (no mid-drag re-render)', () => {
    let calls = 0;
    const unsub = subscribePlaceSession(() => {
      calls += 1;
    });
    beginModuleDrag({ moduleId: 'm4', category: 'project' });
    scheduleEndModuleDrag(5);
    endModuleDrag();
    assert.equal(calls, 0);
    unsub();
  });

  it('pointer pick notifies and survives without HTML5 DataTransfer', () => {
    clearPointerPick();
    let calls = 0;
    const unsub = subscribePlaceSession(() => {
      calls += 1;
    });
    armPointerPick({ moduleId: 'm5', category: 'award' });
    assert.equal(calls, 1);
    assert.deepEqual(getPlacePayload(), {
      moduleId: 'm5',
      category: 'award',
    });
    assert.equal(getPointerPick()?.moduleId, 'm5');
    assert.deepEqual(consumePointerPick()?.moduleId, 'm5');
    assert.equal(getPlacePayload(), null);
    assert.ok(calls >= 2);
    unsub();
  });

  it('default grace is long enough for dragend-before-drop platforms', () => {
    assert.ok(MODULE_DRAG_END_GRACE_MS >= 500);
  });
});
