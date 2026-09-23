import type { Category, SectionId } from '@resume/domain';
import {
  MODULE_DRAG_MIME,
  parseModuleDragPayload,
  serializeModuleDragPayload,
} from '@resume/domain';
import {
  armPointerPick,
  beginModuleDrag,
  clearPointerPick,
  consumePointerPick,
  endModuleDrag,
  getActiveModuleDrag,
  getPlacePayload,
  getPointerPick,
  scheduleEndModuleDrag,
} from './dragSession';

export function setModuleDragData(
  dataTransfer: DataTransfer,
  moduleId: string,
  category: Category,
): void {
  const payload = { moduleId, category };
  const raw = serializeModuleDragPayload(payload);
  beginModuleDrag(payload);
  try {
    dataTransfer.setData(MODULE_DRAG_MIME, raw);
  } catch {
    // WebView2 may reject custom MIME types; text/plain is enough.
  }
  dataTransfer.setData('text/plain', raw);
  dataTransfer.effectAllowed = 'copy';
}

export function clearModuleDrag(): void {
  endModuleDrag();
}

/**
 * Call from onDragEnd. Schedules a grace-period cancel; does not clear yet so
 * drop can still read the session when dragend precedes drop (WebView2).
 */
export function finishModuleDrag(): void {
  scheduleEndModuleDrag();
}

export function pickModuleForPlace(
  moduleId: string,
  category: Category,
): void {
  armPointerPick({ moduleId, category });
}

export function cancelModulePlace(): void {
  clearPointerPick();
  endModuleDrag();
}

export function hasModulePlaceArmed(): boolean {
  return getPointerPick() != null || getActiveModuleDrag() != null;
}

/**
 * Prefer in-memory session (reliable during dragover / after dragend race);
 * fall back to DataTransfer on drop; then pointer-pick.
 */
export function readModuleDragData(
  dataTransfer: DataTransfer | null,
): { moduleId: string; category: Category } | null {
  const live = getPlacePayload();
  if (live) return live;

  if (!dataTransfer) return null;

  let raw = '';
  try {
    raw =
      dataTransfer.getData(MODULE_DRAG_MIME) ||
      dataTransfer.getData('text/plain');
  } catch {
    raw = '';
  }
  if (!raw) return null;
  return parseModuleDragPayload(raw);
}

/** Resolve place payload for a click on a drop zone (pointer-place mode). */
export function takePlacePayloadOnClick(): {
  moduleId: string;
  category: Category;
} | null {
  const picked = consumePointerPick();
  if (picked) return picked;
  const drag = getActiveModuleDrag();
  if (drag) {
    endModuleDrag();
    return drag;
  }
  return null;
}

export function dropZoneClassName(
  base: string,
  opts: { active: boolean; invalid: boolean },
): string {
  const parts = [base];
  if (opts.active) parts.push(`${base}--active`);
  if (opts.invalid) parts.push(`${base}--invalid`);
  return parts.join(' ');
}

export type { SectionId };
export { getPointerPick, getPlacePayload, clearPointerPick };
