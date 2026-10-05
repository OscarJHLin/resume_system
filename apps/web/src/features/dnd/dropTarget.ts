import type { Category, ModuleDragPayload } from '@resume/domain';
import {
  CATEGORY_SECTION_MATRIX,
  SECTION_LABELS,
  decideModuleDrop,
  isBuiltinPlaceableSection,
  isCustomSectionId,
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
  custom: '自定义',
};

export type DropVerdict = { ok: true } | { ok: false; message: string };

function sectionLabel(section: string): string {
  if (isBuiltinPlaceableSection(section) || section in SECTION_LABELS) {
    return SECTION_LABELS[section as keyof typeof SECTION_LABELS];
  }
  if (isCustomSectionId(section)) return '自定义栏目';
  return section;
}

export function judgeDrop(
  payload: ModuleDragPayload,
  section: string,
  customSectionIds?: readonly string[],
): DropVerdict {
  const decision = decideModuleDrop(
    payload.category,
    section,
    customSectionIds,
  );
  if (decision === 'accept') return { ok: true };
  if (decision === 'reject-section') {
    return {
      ok: false,
      message: `「${sectionLabel(section)}」不接受拖入的模块`,
    };
  }
  if (payload.category === 'custom') {
    return {
      ok: false,
      message: `「自定义」记录请拖到简历上的自定义栏目`,
    };
  }
  const target = CATEGORY_SECTION_MATRIX[payload.category][0];
  const hint = target ? `，请拖到「${SECTION_LABELS[target]}」` : '';
  return {
    ok: false,
    message: `「${CATEGORY_LABELS[payload.category]}」记录不能放入「${sectionLabel(section)}」${hint}`,
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
