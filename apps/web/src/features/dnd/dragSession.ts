import type { ModuleDragPayload } from '@resume/domain';

/**
 * In-memory drag / place session (cross-platform: WKWebView + WebView2).
 *
 * Lifecycle for HTML5 DnD:
 *   beginModuleDrag  → arm payload (no UI notify — React re-render mid-drag
 *                      aborts DnD in WKWebView / Safari)
 *   scheduleEndModuleDrag (from dragend) → cancel timer only; do NOT clear yet
 *                      (WebView2 may deliver dragend before drop)
 *   endModuleDrag (from drop / explicit cancel) → clear immediately
 *   timer fires → clear only if drop never consumed the session
 *
 * Pointer place (「放入」): separate arm; notifies so drop zones highlight.
 */

/** Grace period after dragend before treating the drag as cancelled. */
export const MODULE_DRAG_END_GRACE_MS = 500;

let activeDrag: ModuleDragPayload | null = null;
let pointerPick: ModuleDragPayload | null = null;
let endDragTimer: ReturnType<typeof setTimeout> | null = null;
/** Bumps on begin/end so a stale cancel timer cannot wipe a newer drag. */
let dragEpoch = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

function notifyPlace(): void {
  listeners.forEach((l) => l());
}

/** Subscribe to pointer-place changes (drop-zone highlight for 「放入」). */
export function subscribePlaceSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function clearEndDragTimer(): void {
  if (endDragTimer != null) {
    clearTimeout(endDragTimer);
    endDragTimer = null;
  }
}

export function beginModuleDrag(payload: ModuleDragPayload): void {
  clearEndDragTimer();
  dragEpoch += 1;
  activeDrag = payload;
  // Intentionally no notifyPlace(): HTML5 drag must not trigger React commits.
}

/** Immediate clear after a successful drop or explicit cancel. */
export function endModuleDrag(): void {
  clearEndDragTimer();
  dragEpoch += 1;
  if (activeDrag == null) return;
  activeDrag = null;
}

/**
 * Call from dragend. Does not clear immediately — keeps the payload until
 * drop consumes it (endModuleDrag) or grace elapses (cancel / drop outside).
 */
export function scheduleEndModuleDrag(
  delayMs: number = MODULE_DRAG_END_GRACE_MS,
): void {
  clearEndDragTimer();
  const epoch = dragEpoch;
  endDragTimer = setTimeout(() => {
    endDragTimer = null;
    if (epoch !== dragEpoch) return;
    if (activeDrag == null) return;
    activeDrag = null;
  }, delayMs);
}

export function getActiveModuleDrag(): ModuleDragPayload | null {
  return activeDrag;
}

/** Armed module for click-to-place (no HTML5 DnD required). */
export function armPointerPick(payload: ModuleDragPayload): void {
  pointerPick = payload;
  notifyPlace();
}

export function clearPointerPick(): void {
  if (pointerPick == null) return;
  pointerPick = null;
  notifyPlace();
}

export function getPointerPick(): ModuleDragPayload | null {
  return pointerPick;
}

export function consumePointerPick(): ModuleDragPayload | null {
  const p = pointerPick;
  if (p == null) return null;
  pointerPick = null;
  notifyPlace();
  return p;
}

/**
 * Prefer live HTML5 drag, then pointer-pick, for drop-zone hover / drop / click.
 */
export function getPlacePayload(): ModuleDragPayload | null {
  return activeDrag ?? pointerPick;
}
