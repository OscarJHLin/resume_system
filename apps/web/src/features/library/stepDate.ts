/**
 * Stepwise date helpers: year → month → day → YYYY-MM-DD.
 * Empty string means unset (optional fields).
 */

export type DateStep = 'closed' | 'year' | 'month' | 'day';

export interface IsoDateParts {
  year: number | null;
  month: number | null;
  day: number | null;
}

/** Parse YYYY-MM-DD into parts; invalid/empty → all null. */
export function parseIsoDateParts(iso: string): IsoDateParts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return { year: null, month: null, day: null };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return { year: null, month: null, day: null };
  }
  return { year, month, day };
}

/** Build YYYY-MM-DD; returns '' if incomplete. */
export function buildIsoDate(
  year: number | null,
  month: number | null,
  day: number | null,
): string {
  if (year == null || month == null || day == null) return '';
  if (month < 1 || month > 12) return '';
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return '';
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Inclusive year list, newest first (default: current+1 down 80 years). */
export function yearOptions(
  centerYear: number = new Date().getFullYear(),
  past = 80,
  future = 1,
): number[] {
  const start = centerYear + future;
  const end = centerYear - past;
  const out: number[] = [];
  for (let y = start; y >= end; y -= 1) out.push(y);
  return out;
}

export const MONTH_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 1, label: '1 月' },
  { value: 2, label: '2 月' },
  { value: 3, label: '3 月' },
  { value: 4, label: '4 月' },
  { value: 5, label: '5 月' },
  { value: 6, label: '6 月' },
  { value: 7, label: '7 月' },
  { value: 8, label: '8 月' },
  { value: 9, label: '9 月' },
  { value: 10, label: '10 月' },
  { value: 11, label: '11 月' },
  { value: 12, label: '12 月' },
];

export function dayOptions(year: number, month: number): number[] {
  const n = daysInMonth(year, month);
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** Display label for a stored ISO date (Chinese stepwise summary). */
export function formatIsoDateLabel(iso: string): string {
  const p = parseIsoDateParts(iso);
  if (p.year == null || p.month == null || p.day == null) return '选择日期';
  return `${p.year} 年 ${p.month} 月 ${p.day} 日`;
}

/**
 * Advance step machine after a selection.
 * year → month → day → closed (value complete).
 */
export function nextDateStep(current: DateStep): DateStep {
  if (current === 'year') return 'month';
  if (current === 'month') return 'day';
  return 'closed';
}
