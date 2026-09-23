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
  scheduleEndModuleDrag,
} from './features/dnd/dragSession.js';
import { readModuleDragData } from './features/dnd/dragPayload.js';

describe('drag session WebView2 race', () => {
  it('keeps payload after scheduled dragend until delay elapses', async () => {
    beginModuleDrag({ moduleId: 'm1', category: 'project' });
    assert.deepEqual(getActiveModuleDrag(), {
      moduleId: 'm1',
      category: 'project',
    });
    scheduleEndModuleDrag(30);
    // Immediately after dragend schedule, drop can still read.
    assert.deepEqual(getPlacePayload()?.moduleId, 'm1');
    assert.deepEqual(readModuleDragData(null)?.moduleId, 'm1');
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(getActiveModuleDrag(), null);
  });

  it('endModuleDrag clears immediately for successful drop', () => {
    beginModuleDrag({ moduleId: 'm2', category: 'internship' });
    endModuleDrag();
    assert.equal(getActiveModuleDrag(), null);
  });

  it('pointer pick survives without HTML5 DataTransfer', () => {
    clearPointerPick();
    armPointerPick({ moduleId: 'm3', category: 'award' });
    assert.deepEqual(getPlacePayload(), {
      moduleId: 'm3',
      category: 'award',
    });
    assert.deepEqual(consumePointerPick()?.moduleId, 'm3');
    assert.equal(getPlacePayload(), null);
  });
});
