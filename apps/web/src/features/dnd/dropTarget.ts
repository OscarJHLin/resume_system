import type { Category, ModuleDragPayload, SectionId } from '@resume/domain';
import {
  CATEGORY_SECTION_MATRIX,
  SECTION_LABELS,
  decideModuleDrop,
} from '@resume/domain';

export interface Point {
  x: number;
  y: number;
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Movement (px) before a pointerdown on a card becomes a drag, so clicks stay clicks. */
export const DRAG_START_THRESHOLD_PX = 5;

export function exceedsDragThreshold(
  start: Point,
  current: Point,
  threshold: number = DRAG_START_THRESHOLD_PX,
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return dx * dx + dy * dy >= threshold * threshold;
}

export function rectContains(rect: RectLike, p: Point): boolean {
  return (
    p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom
  );
}

/** First zone whose current rect contains the point (rects re-read per call; zones scroll). */
export function hitTestZones<Z extends { getRect(): RectLike | null }>(
  point: Point,
  zones: Iterable<Z>,
): Z | null {
  for (const zone of zones) {
    const rect = zone.getRect();
    if (rect && rectContains(rect, point)) return zone;
  }
  return null;
}

const CATEGORY_LABELS: Record<Category, string> = {
  skill: '技能',
  project: '项目',
  internship: '实习',
  award: '获奖与证书',
};

export type DropVerdict = { ok: true } | { ok: false; message: string };

export function judgeDrop(
  payload: ModuleDragPayload,
  section: SectionId,
): DropVerdict {
  const decision = decideModuleDrop(payload.category, section);
  if (decision === 'accept') return { ok: true };
  if (decision === 'reject-section') {
    return { ok: false, message: `「${SECTION_LABELS[section]}」不接受拖入的模块` };
  }
  const target = CATEGORY_SECTION_MATRIX[payload.category][0];
  const hint = target ? `，请拖到「${SECTION_LABELS[target]}」` : '';
  return {
    ok: false,
    message: `「${CATEGORY_LABELS[payload.category]}」记录不能放入「${SECTION_LABELS[section]}」${hint}`,
  };
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
