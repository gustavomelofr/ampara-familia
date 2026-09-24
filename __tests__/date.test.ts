import { describe, expect, it } from '@jest/globals';

import { formatDate, isValidIsoDate, toLocalIsoDate } from '@/src/utils/date';

describe('date helpers', () => {
  it('formats dates from local calendar fields without shifting the day', () => {
    const localMorning = new Date(2026, 8, 23, 8, 15);
    expect(toLocalIsoDate(localMorning)).toBe('2026-09-23');
    expect(formatDate('2026-09-23')).toBe('23 de setembro');
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-9-03')).toBe(false);
    expect(isValidIsoDate('2024-02-29')).toBe(true);
  });
});
