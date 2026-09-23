import type { ModuleDragPayload } from '@resume/domain';

/**
 * In-memory drag / place session.
 *
 * - HTML5 DnD: browsers often block getData() until drop; WebView2 may fire
 *   dragend *before* drop, so we delay clearing the live drag payload.
 * - Pointer place: arm a module then click a canvas drop zone (DnD fallback).
 */
let activeDrag: ModuleDragPayload | null = null;
let pointerPick: ModuleDragPayload | null = null;
let endDragTimer: ReturnType<typeof setTimeout> | null = null;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((l) => l());
}

/** Subscribe to place-session changes (for drop-zone highlight). */
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
  activeDrag = payload;
  notify();
}

/** Immediate clear (after a successful drop). */
export function endModuleDrag(): void {
  clearEndDragTimer();
  if (activeDrag == null) return;
  activeDrag = null;
  notify();
}

/**
 * Schedule clear after dragend. WebView2 / Chromium can deliver dragend before
 * drop; keep the payload briefly so drop handlers still see it.
 */
export function scheduleEndModuleDrag(delayMs = 120): void {
  clearEndDragTimer();
  endDragTimer = setTimeout(() => {
    endDragTimer = null;
    if (activeDrag == null) return;
    activeDrag = null;
    notify();
  }, delayMs);
}

export function getActiveModuleDrag(): ModuleDragPayload | null {
  return activeDrag;
}

/** Armed module for click-to-place (no HTML5 DnD required). */
export function armPointerPick(payload: ModuleDragPayload): void {
  pointerPick = payload;
  notify();
}

export function clearPointerPick(): void {
  if (pointerPick == null) return;
  pointerPick = null;
  notify();
}

export function getPointerPick(): ModuleDragPayload | null {
  return pointerPick;
}

export function consumePointerPick(): ModuleDragPayload | null {
  const p = pointerPick;
  if (p == null) return null;
  pointerPick = null;
  notify();
  return p;
}

/**
 * Prefer live HTML5 drag, then pointer-pick, for drop-zone hover / drop / click.
 */
export function getPlacePayload(): ModuleDragPayload | null {
  return activeDrag ?? pointerPick;
}
