import { describe, it, expect } from 'vitest';
import { halfUpRound } from './money.js';

describe('halfUpRound', () => {
  it('rounds .5 away from zero at the given decimal precision (matches BigDecimal HALF_UP)', () => {
    expect(halfUpRound(2.345, 2)).toBe(2.35);
    expect(halfUpRound(2.005, 2)).toBe(2.01);
    expect(halfUpRound(30000, 2)).toBe(30000);
  });

  it('defaults to 0 decimal places', () => {
    expect(halfUpRound(2.5)).toBe(3);
    expect(halfUpRound(-2.5)).toBe(-3);
  });
});
