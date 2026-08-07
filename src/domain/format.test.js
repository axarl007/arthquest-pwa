import { describe, it, expect } from 'vitest';
import { formatINR, shortDate, dLabel, monthLabel, currentMonthKey, addMonthsToKey, compareMonthKeys } from './format.js';

describe('formatINR', () => {
  it('formats thousands with Indian grouping', () => {
    expect(formatINR(120000)).toBe('₹1,20,000');
  });
  it('formats small numbers without extra commas', () => {
    expect(formatINR(850)).toBe('₹850');
    expect(formatINR(0)).toBe('₹0');
  });
  it('formats crores correctly', () => {
    expect(formatINR(12345678)).toBe('₹1,23,45,678');
  });
  it('rounds fractional values', () => {
    expect(formatINR(1999.6)).toBe('₹2,000');
  });
  it('handles negative values with a leading minus before the symbol', () => {
    expect(formatINR(-4200)).toBe('-₹4,200');
  });
});

describe('shortDate', () => {
  it('formats an ISO date as "D Mon"', () => {
    expect(shortDate('2026-08-01')).toBe('1 Aug');
    expect(shortDate('2026-12-25')).toBe('25 Dec');
  });
});

describe('dLabel', () => {
  it('labels the reference date as Today', () => {
    expect(dLabel('2026-08-07', '2026-08-07')).toBe('Today, 7 Aug');
  });
  it('labels the day before the reference date as Yesterday', () => {
    expect(dLabel('2026-08-06', '2026-08-07')).toBe('Yesterday, 6 Aug');
  });
  it('falls back to short date for anything older', () => {
    expect(dLabel('2026-07-14', '2026-08-07')).toBe('14 Jul');
  });
});

describe('monthLabel', () => {
  it('formats a YYYY-MM key as "Month YYYY"', () => {
    expect(monthLabel('2026-08')).toBe('August 2026');
    expect(monthLabel('2026-01')).toBe('January 2026');
  });
});

describe('currentMonthKey', () => {
  it('derives a YYYY-MM key from a given date', () => {
    expect(currentMonthKey(new Date('2026-08-07T12:00:00Z'))).toBe('2026-08');
  });
});

describe('addMonthsToKey', () => {
  it('adds months within a year', () => {
    expect(addMonthsToKey('2026-08', -1)).toBe('2026-07');
    expect(addMonthsToKey('2026-08', 1)).toBe('2026-09');
  });
  it('rolls over year boundaries', () => {
    expect(addMonthsToKey('2026-01', -1)).toBe('2025-12');
    expect(addMonthsToKey('2026-12', 1)).toBe('2027-01');
  });
});

describe('compareMonthKeys', () => {
  it('orders keys chronologically', () => {
    expect(compareMonthKeys('2026-07', '2026-08')).toBeLessThan(0);
    expect(compareMonthKeys('2026-08', '2026-07')).toBeGreaterThan(0);
    expect(compareMonthKeys('2026-08', '2026-08')).toBe(0);
  });
});
