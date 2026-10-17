import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import type { ModuleDragPayload, SectionId } from '@resume/domain';
import {
  armPointerPick,
  cancelModuleDrag,
  clearPointerPick,
  getPlaceSnapshot,
  isModuleDragActive,
  moveModuleDrag,
  pressModuleDrag,
  registerDropZone,
  releaseModuleDrag,
  subscribePlaceSession,
  type DropZone,
} from './features/dnd/dragSession.js';
import {
  DRAG_START_THRESHOLD_PX,
  exceedsDragThreshold,
  hitTestZones,
  judgeDrop,
  type RectLike,
} from './features/dnd/dropTarget.js';

const project: ModuleDragPayload = { moduleId: 'p1', category: 'project' };

function rect(left: number, top: number, w: number, h: number): RectLike {
  return { left, top, right: left + w, bottom: top + h };
}

function zone(section: SectionId, r: RectLike | null) {
  const drops: ModuleDragPayload[] = [];
  const z: DropZone = { section, getRect: () => r, onDrop: (p) => drops.push(p) };
  return { z, drops };
}

const cleanups: Array<() => void> = [];
function register(z: DropZone) {
  cleanups.push(registerDropZone(z));
}

afterEach(() => {
  cancelModuleDrag();
  clearPointerPick();
  cleanups.splice(0).forEach((c) => c());
});

describe('drag threshold', () => {
  it('ignores jitter below the threshold', () => {
    assert.equal(exceedsDragThreshold({ x: 0, y: 0 }, { x: 3, y: 3 }), false);
    assert.equal(
      exceedsDragThreshold({ x: 0, y: 0 }, { x: DRAG_START_THRESHOLD_PX, y: 0 }),
      true,
    );
  });
});

describe('hitTestZones', () => {
  it('returns the zone containing the point, skipping unmounted rects', () => {
    const a = { id: 'a', getRect: () => rect(0, 0, 100, 50) };
    const gone = { id: 'gone', getRect: () => null };
    const b = { id: 'b', getRect: () => rect(0, 60, 100, 50) };
    assert.equal(hitTestZones({ x: 10, y: 70 }, [gone, a, b])?.id, 'b');
    assert.equal(hitTestZones({ x: 10, y: 10 }, [gone, a, b])?.id, 'a');
    assert.equal(hitTestZones({ x: 10, y: 55 }, [a, b]), null);
    assert.equal(hitTestZones({ x: 200, y: 10 }, [a, b]), null);
  });
});

describe('judgeDrop', () => {
  it('accepts each category only in its own section', () => {
    assert.deepEqual(judgeDrop(project, 'projects'), { ok: true });
    assert.deepEqual(
      judgeDrop({ moduleId: 'i', category: 'internship' }, 'internships'),
      { ok: true },
    );
    assert.deepEqual(judgeDrop({ moduleId: 'a', category: 'award' }, 'awards'), {
      ok: true,
    });
    assert.deepEqual(
      judgeDrop({ moduleId: 'c', category: 'campus' }, 'campuses'),
      { ok: true },
    );
    assert.equal(
      judgeDrop({ moduleId: 'c', category: 'campus' }, 'internships').ok,
      false,
    );
  });

  it('explains wrong-category drops and names the right section', () => {
    const v = judgeDrop(project, 'awards');
    assert.equal(v.ok, false);
    assert.ok(!v.ok && v.message.includes('项目'));
    assert.ok(!v.ok && v.message.includes('项目经历'));
    assert.ok(!v.ok && v.message.includes('获奖与证书'));
  });

  it('rejects non-placeable sections', () => {
    const v = judgeDrop(project, 'skills');
    assert.equal(v.ok, false);
  });
});

describe('pointer drag session', () => {
  it('drops on the zone under the pointer after crossing the threshold', () => {
    const projects = zone('projects', rect(0, 0, 300, 100));
    const awards = zone('awards', rect(0, 200, 300, 100));
    register(projects.z);
    register(awards.z);

    pressModuleDrag(project, '拼履', { x: 500, y: 50 });
    assert.equal(isModuleDragActive(), false);
    assert.equal(moveModuleDrag({ x: 498, y: 50 }), false);
    assert.equal(moveModuleDrag({ x: 400, y: 50 }), true);
    assert.equal(getPlaceSnapshot().dragging, project);
    assert.equal(getPlaceSnapshot().dragLabel, '拼履');
    assert.equal(getPlaceSnapshot().hoverSection, null);

    moveModuleDrag({ x: 100, y: 50 });
    assert.equal(getPlaceSnapshot().hoverSection, 'projects');

    assert.equal(releaseModuleDrag({ x: 100, y: 50 }), 'dropped');
    assert.deepEqual(projects.drops, [project]);
    assert.deepEqual(awards.drops, []);
    assert.equal(getPlaceSnapshot().dragging, null);
    assert.equal(isModuleDragActive(), false);
  });

  it('hands wrong-category drops to the zone so it can show a hint', () => {
    const awards = zone('awards', rect(0, 0, 300, 100));
    register(awards.z);
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    moveModuleDrag({ x: 50, y: 50 });
    assert.equal(releaseModuleDrag({ x: 50, y: 50 }), 'dropped');
    assert.deepEqual(awards.drops, [project]);
  });

  it('treats a release without movement as a click', () => {
    const projects = zone('projects', rect(0, 0, 300, 100));
    register(projects.z);
    pressModuleDrag(project, 'p', { x: 10, y: 10 });
    assert.equal(releaseModuleDrag({ x: 11, y: 10 }), 'click');
    assert.deepEqual(projects.drops, []);
  });

  it('reports a miss when released outside every zone', () => {
    const projects = zone('projects', rect(0, 0, 300, 100));
    register(projects.z);
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    moveModuleDrag({ x: 450, y: 400 });
    assert.equal(releaseModuleDrag({ x: 450, y: 400 }), 'missed');
    assert.deepEqual(projects.drops, []);
  });

  it('cancel clears the drag without dropping', () => {
    const projects = zone('projects', rect(0, 0, 300, 100));
    register(projects.z);
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    moveModuleDrag({ x: 50, y: 50 });
    cancelModuleDrag();
    assert.equal(getPlaceSnapshot().dragging, null);
    assert.equal(releaseModuleDrag({ x: 50, y: 50 }), 'click');
    assert.deepEqual(projects.drops, []);
  });

  it('re-reads zone rects on every move (scrolling canvas)', () => {
    let r = rect(0, 0, 300, 100);
    const projects: DropZone = {
      section: 'projects',
      getRect: () => r,
      onDrop: () => undefined,
    };
    register(projects);
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    moveModuleDrag({ x: 50, y: 50 });
    assert.equal(getPlaceSnapshot().hoverSection, 'projects');
    r = rect(0, 300, 300, 100);
    moveModuleDrag({ x: 50, y: 51 });
    assert.equal(getPlaceSnapshot().hoverSection, null);
  });

  it('unregistered zones are no longer hit', () => {
    const projects = zone('projects', rect(0, 0, 300, 100));
    const off = registerDropZone(projects.z);
    off();
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    moveModuleDrag({ x: 50, y: 50 });
    assert.equal(releaseModuleDrag({ x: 50, y: 50 }), 'missed');
  });

  it('notifies subscribers only when visible state changes', () => {
    register(zone('projects', rect(0, 0, 300, 100)).z);
    let calls = 0;
    const unsub = subscribePlaceSession(() => {
      calls += 1;
    });
    pressModuleDrag(project, 'p', { x: 500, y: 50 });
    assert.equal(calls, 0);
    moveModuleDrag({ x: 400, y: 50 });
    assert.equal(calls, 1);
    moveModuleDrag({ x: 390, y: 50 });
    assert.equal(calls, 1);
    moveModuleDrag({ x: 50, y: 50 });
    assert.equal(calls, 2);
    releaseModuleDrag({ x: 50, y: 50 });
    assert.equal(calls, 3);
    unsub();
  });
});

describe('「放入」click-to-place', () => {
  it('arms, is visible in the snapshot, and clears', () => {
    let calls = 0;
    const unsub = subscribePlaceSession(() => {
      calls += 1;
    });
    armPointerPick({ moduleId: 'a1', category: 'award' });
    assert.equal(getPlaceSnapshot().picked?.moduleId, 'a1');
    clearPointerPick();
    assert.equal(getPlaceSnapshot().picked, null);
    assert.equal(calls, 2);
    unsub();
  });

  it('starting a real drag clears a pending pick', () => {
    armPointerPick({ moduleId: 'a1', category: 'award' });
    pressModuleDrag(project, 'p', { x: 0, y: 0 });
    moveModuleDrag({ x: 20, y: 0 });
    assert.equal(getPlaceSnapshot().picked, null);
  });
});
