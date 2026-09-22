import type { Category, SectionId } from '@resume/domain';
import {
  MODULE_DRAG_MIME,
  parseModuleDragPayload,
  serializeModuleDragPayload,
} from '@resume/domain';
import {
  beginModuleDrag,
  endModuleDrag,
  getActiveModuleDrag,
} from './dragSession';

export function setModuleDragData(
  dataTransfer: DataTransfer,
  moduleId: string,
  category: Category,
): void {
  const payload = { moduleId, category };
  const raw = serializeModuleDragPayload(payload);
  beginModuleDrag(payload);
  dataTransfer.setData(MODULE_DRAG_MIME, raw);
  // Fallback for browsers that strip custom MIME types during DnD.
  dataTransfer.setData('text/plain', raw);
  dataTransfer.effectAllowed = 'copy';
}

export function clearModuleDrag(): void {
  endModuleDrag();
}

/**
 * Prefer in-memory session (reliable during dragover);
 * fall back to DataTransfer on drop.
 */
export function readModuleDragData(
  dataTransfer: DataTransfer,
): { moduleId: string; category: Category } | null {
  const live = getActiveModuleDrag();
  if (live) return live;

  const raw =
    dataTransfer.getData(MODULE_DRAG_MIME) ||
    dataTransfer.getData('text/plain');
  if (!raw) return null;
  return parseModuleDragPayload(raw);
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
