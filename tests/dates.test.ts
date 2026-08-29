import { describe, it, expect } from 'vitest';
import { formatLiDate, durationMonths } from '../src/utils/dates.js';

describe('formatLiDate', () => {
  it('formats year + month', () => {
    expect(formatLiDate({ year: 2025, month: 5 })).toBe('2025-05');
  });
  it('formats year only', () => {
    expect(formatLiDate({ year: 2022 })).toBe('2022');
  });
  it('returns null for empty', () => {
    expect(formatLiDate(null)).toBeNull();
    expect(formatLiDate({})).toBeNull();
  });
});

describe('durationMonths', () => {
  it('counts inclusive months for a closed range', () => {
    expect(durationMonths({ year: 2020, month: 1 }, { year: 2020, month: 3 })).toBe(3);
  });
  it('uses now for an open range', () => {
    const now = new Date(Date.UTC(2024, 0, 1)); // Jan 2024
    expect(durationMonths({ year: 2023, month: 1 }, null, now)).toBe(13);
  });
  it('returns null without a start year', () => {
    expect(durationMonths(null, null)).toBeNull();
  });
});
