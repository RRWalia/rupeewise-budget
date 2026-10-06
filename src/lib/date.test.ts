import { describe, expect, it } from 'vitest';
import { addDaysLocal, getDaysInMonth, getLocalDateInputValue, getMonthKey, getRelativeMonthKey, parseDateOnlyLocal } from '@/lib/date';

describe('date utilities', () => {
  it('parses date-only strings in local time', () => {
    const parsed = parseDateOnlyLocal('2026-10-06');

    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(9);
    expect(parsed.getDate()).toBe(6);
  });

  it('formats date input values without UTC day drift', () => {
    const date = new Date(2026, 9, 6, 0, 15);

    expect(getLocalDateInputValue(date)).toBe('2026-10-06');
  });

  it('calculates month keys and month lengths', () => {
    expect(getMonthKey('2026-10-31')).toBe('2026-10');
    expect(getRelativeMonthKey('2026-01', -1)).toBe('2025-12');
    expect(getDaysInMonth('2024-02')).toBe(29);
  });

  it('adds days in local calendar time', () => {
    expect(getLocalDateInputValue(addDaysLocal(new Date(2026, 9, 1), -1))).toBe('2026-09-30');
  });
});
