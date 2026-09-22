/**
 * timeRange serialization for module forms.
 * Stored as human-readable range matching resume style (dots, optional end).
 * Empty / both blank → undefined (optional field).
 */

export interface TimeRangeParts {
  /** HTML date input value YYYY-MM-DD, or '' */
  start: string;
  end: string;
}

/** Convert YYYY-MM-DD → YYYY.MM.DD */
export function isoDateToDisplay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return iso.trim();
  return `${m[1]}.${m[2]}.${m[3]}`;
}

/** Convert YYYY.MM.DD or YYYY.MM → YYYY-MM-DD (day defaults to 01 for month-only). */
export function displayDateToIso(display: string): string {
  const full = /^(\d{4})\.(\d{2})\.(\d{2})$/.exec(display.trim());
  if (full) return `${full[1]}-${full[2]}-${full[3]}`;
  const month = /^(\d{4})\.(\d{2})$/.exec(display.trim());
  if (month) return `${month[1]}-${month[2]}-01`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(display.trim());
  if (iso) return display.trim();
  return '';
}

/**
 * Build timeRange string for API.
 * - both empty → undefined
 * - start only → "YYYY.MM.DD"
 * - both → "YYYY.MM.DD - YYYY.MM.DD"
 * - end only → treated as start-only (end alone is invalid; returns start undefined → use end as single)
 */
export function formatTimeRange(parts: TimeRangeParts): string | undefined {
  const start = parts.start.trim();
  const end = parts.end.trim();
  if (!start && !end) return undefined;
  if (start && !end) return isoDateToDisplay(start);
  if (!start && end) return isoDateToDisplay(end);
  return `${isoDateToDisplay(start)} - ${isoDateToDisplay(end)}`;
}

/** Parse stored timeRange back into date-input values. */
export function parseTimeRange(timeRange?: string | null): TimeRangeParts {
  if (!timeRange?.trim()) return { start: '', end: '' };
  const raw = timeRange.trim();
  const range = raw.split(/\s*[-–—]\s*/);
  if (range.length >= 2) {
    return {
      start: displayDateToIso(range[0]!),
      end: displayDateToIso(range[1]!),
    };
  }
  return { start: displayDateToIso(raw), end: '' };
}

/** Validate optional range: if both set, start <= end. */
export function validateTimeRangeParts(
  parts: TimeRangeParts,
): string | null {
  const start = parts.start.trim();
  const end = parts.end.trim();
  if (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) {
    return '开始日期格式无效';
  }
  if (end && !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return '结束日期格式无效';
  }
  if (start && end && start > end) {
    return '开始日期不能晚于结束日期';
  }
  return null;
}
