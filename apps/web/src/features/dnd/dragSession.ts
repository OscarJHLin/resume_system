import type { ModuleDragPayload } from '@resume/domain';
import {
  exceedsDragThreshold,
  hitTestZones,
  type Point,
  type RectLike,
} from './dropTarget';

/**
 * Pointer-driven module drag + 「放入」click-to-place, shared by library cards
 * and resume drop zones. No HTML5 DnD: Tauri's native drag-drop handler
 * swallows dragover/drop in WKWebView and WebView2, pointer events are not
 * affected.
 *
 *   pressModuleDrag (pointerdown) → pending
 *   moveModuleDrag  (pointermove) → dragging once past the threshold; tracks hover zone
 *   releaseModuleDrag (pointerup) → drops on the zone under the pointer, if any
 *   cancelModuleDrag (Escape / pointercancel)
 */

export interface DropZone {
  section: string;
  getRect(): RectLike | null;
  onDrop(payload: ModuleDragPayload): void;
}

export interface PlaceSnapshot {
  /** Module being dragged (past the threshold), else null. */
  dragging: ModuleDragPayload | null;
  dragLabel: string;
  hoverSection: string | null;
  /** Module armed via 「放入」. */
  picked: ModuleDragPayload | null;
}
export type ReleaseOutcome = 'click' | 'dropped' | 'missed';

interface DragState {
  payload: ModuleDragPayload;
  label: string;
  start: Point;
  dragging: boolean;
  hover: DropZone | null;
}

const EMPTY: PlaceSnapshot = {
  dragging: null,
  dragLabel: '',
  hoverSection: null,
  picked: null,
};

const zones = new Set<DropZone>();
let drag: DragState | null = null;
let pointerPick: ModuleDragPayload | null = null;
let snapshot: PlaceSnapshot = EMPTY;

type Listener = () => void;
const listeners = new Set<Listener>();

function publish(): void {
  const next: PlaceSnapshot = {
    dragging: drag?.dragging ? drag.payload : null,
    dragLabel: drag?.dragging ? drag.label : '',
    hoverSection: drag?.dragging ? (drag.hover?.section ?? null) : null,
    picked: pointerPick,
  };
  if (
    next.dragging === snapshot.dragging &&
    next.hoverSection === snapshot.hoverSection &&
    next.picked === snapshot.picked
  ) {
    return;
  }
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribePlaceSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPlaceSnapshot(): PlaceSnapshot {
  return snapshot;
}

export function registerDropZone(zone: DropZone): () => void {
  zones.add(zone);
  return () => {
    zones.delete(zone);
    if (drag?.hover === zone) {
      drag.hover = null;
      publish();
    }
  };
}

export function pressModuleDrag(
  payload: ModuleDragPayload,
  label: string,
  start: Point,
): void {
  drag = { payload, label, start, dragging: false, hover: null };
}

/** Returns true while a drag is in progress (caller should suppress default). */
export function moveModuleDrag(point: Point): boolean {
  if (!drag) return false;
  if (!drag.dragging) {
    if (!exceedsDragThreshold(drag.start, point)) return false;
    drag.dragging = true;
    pointerPick = null;
  }
  drag.hover = hitTestZones(point, zones);
  publish();
  return true;
}

export function releaseModuleDrag(point: Point): ReleaseOutcome {
  const state = drag;
  drag = null;
  if (!state || !state.dragging) {
    publish();
    return 'click';
  }
  const zone = hitTestZones(point, zones);
  publish();
  if (!zone) return 'missed';
  zone.onDrop(state.payload);
  return 'dropped';
}

export function cancelModuleDrag(): void {
  if (!drag) return;
  drag = null;
  publish();
}

export function isModuleDragActive(): boolean {
  return drag?.dragging ?? false;
}

export function armPointerPick(payload: ModuleDragPayload): void {
  pointerPick = payload;
  publish();
}

export function clearPointerPick(): void {
  pointerPick = null;
  publish();
}
