import { describe, expect, it } from '@jest/globals';

import { parseBrlAmountToCents } from '@/src/utils/money';

describe('Brazilian real amount parsing', () => {
  it.each([
    ['25,90', 2590],
    ['1.234,56', 123456],
    ['1234.56', 123456],
    ['R$ 8,5', 850],
    ['10', 1000],
  ])('parses %s to cents', (input, expected) => {
    expect(parseBrlAmountToCents(input)).toBe(expected);
  });

  it.each(['', '0', '0,00', '-5,00', '1,234', '1.2,3', '12.34,56', 'abc', '1,2,3'])('rejects invalid amount %s', (input) => {
    expect(parseBrlAmountToCents(input)).toBeNull();
  });
});
