/** LinkedIn date primitives. Month is 1-based and often absent; day is rare. */
export interface LiDate {
  year?: number;
  month?: number;
  day?: number;
}

export interface LiDateRange {
  start?: LiDate | null;
  end?: LiDate | null;
}

/** `{year:2025, month:5}` -> `"2025-05"`. Year-only -> `"2025"`. Empty -> null. */
export function formatLiDate(date: LiDate | null | undefined): string | null {
  if (!date || typeof date.year !== 'number') return null;
  if (typeof date.month === 'number') {
    return `${date.year}-${String(date.month).padStart(2, '0')}`;
  }
  return String(date.year);
}

/**
 * Whole months between start and (end ?? now), inclusive of the start month.
 * Returns null if there is no usable start year.
 */
export function durationMonths(
  start: LiDate | null | undefined,
  end: LiDate | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!start || typeof start.year !== 'number') return null;
  const startMonths = start.year * 12 + ((start.month ?? 1) - 1);
  const endYear = end?.year ?? now.getUTCFullYear();
  const endMonth = end?.year ? (end.month ?? 12) : now.getUTCMonth() + 1;
  const endMonths = endYear * 12 + (endMonth - 1);
  return Math.max(0, endMonths - startMonths) + 1;
}
