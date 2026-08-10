import { describe, it, expect } from 'vitest';
import {
  buildOnboardingRows,
  allocationTotals,
  saveAllocations,
  ensureMonthSeeded,
  sanitizePercentageInput,
  parsePercentageInput,
} from './allocations.js';

const cat = (id, name, group, over = {}) => ({ id, name, icon: 'category', type: 'budget', group, archived: false, ...over });

describe('buildOnboardingRows', () => {
  const categories = [
    cat('1', 'Housing', 'needs'),
    cat('2', 'Groceries', 'needs'),
    cat('3', 'Custom Thing', 'wants'), // not a known default name
    cat('4', 'Archived Cat', 'needs', { archived: true }),
    cat('5', 'A Quest', 'savings', { type: 'quest' }),
  ];

  it('includes only non-archived BUDGET-type categories, sorted alphabetically by name', () => {
    const rows = buildOnboardingRows(categories, [], '2026-08');
    expect(rows.map((r) => r.name)).toEqual(['Custom Thing', 'Groceries', 'Housing']);
  });

  it('falls back to the default percentage by name when no allocation exists for the month', () => {
    const rows = buildOnboardingRows(categories, [], '2026-08');
    const housing = rows.find((r) => r.name === 'Housing');
    expect(housing.percentage).toBe(25);
  });

  it('falls back to 0 for a category with no matching default name', () => {
    const rows = buildOnboardingRows(categories, [], '2026-08');
    const custom = rows.find((r) => r.name === 'Custom Thing');
    expect(custom.percentage).toBe(0);
  });

  it('prefers an existing allocation for the current month over the default percentage', () => {
    const allocations = [{ id: 'a1', categoryId: '1', month: '2026-08', percentage: 40, amount: 48000 }];
    const rows = buildOnboardingRows(categories, allocations, '2026-08');
    expect(rows.find((r) => r.name === 'Housing').percentage).toBe(40);
  });

  it('ignores an allocation from a different month', () => {
    const allocations = [{ id: 'a1', categoryId: '1', month: '2026-07', percentage: 40, amount: 48000 }];
    const rows = buildOnboardingRows(categories, allocations, '2026-08');
    expect(rows.find((r) => r.name === 'Housing').percentage).toBe(25);
  });
});

describe('allocationTotals', () => {
  it('sums percentages and flags over-allocation above 100', () => {
    const t = allocationTotals([{ percentage: 60 }, { percentage: 30 }]);
    expect(t.allocatedPercentage).toBe(90);
    expect(t.remainingPercentage).toBe(10);
    expect(t.isOverAllocated).toBe(false);
  });

  it('flags exactly 100 as not over-allocated', () => {
    expect(allocationTotals([{ percentage: 100 }]).isOverAllocated).toBe(false);
  });

  it('flags over 100 as over-allocated with negative remaining', () => {
    const t = allocationTotals([{ percentage: 70 }, { percentage: 40 }]);
    expect(t.isOverAllocated).toBe(true);
    expect(t.remainingPercentage).toBe(-10);
  });

  it('sums fractional percentages correctly, half-up rounded to 2dp (no float drift artifacts)', () => {
    const rows = [{ percentage: 4.5 }, { percentage: 8.1 }, { percentage: 12.3 }, { percentage: 0.1 }];
    const t = allocationTotals(rows);
    expect(t.allocatedPercentage).toBe(25);
    expect(t.remainingPercentage).toBe(75);
  });

  it('does not false-positive over-allocate from float summation error at exactly 100', () => {
    // 0.1 + 0.2 !== 0.3 in raw JS float math; a run of fractional rows landing on exactly
    // 100% must not spuriously trip isOverAllocated from residual float dust.
    const rows = [{ percentage: 33.3 }, { percentage: 33.3 }, { percentage: 33.4 }];
    const t = allocationTotals(rows);
    expect(t.allocatedPercentage).toBe(100);
    expect(t.isOverAllocated).toBe(false);
  });
});

describe('saveAllocations', () => {
  it('computes each row amount as percentage/100 * income, half-up rounded to paise', () => {
    const rows = [{ categoryId: '1', percentage: 25 }, { categoryId: '2', percentage: 8 }];
    const result = saveAllocations(120000, rows, '2026-08');
    expect(result.find((r) => r.categoryId === '1').amount).toBe(30000);
    expect(result.find((r) => r.categoryId === '2').amount).toBe(9600);
    expect(result.every((r) => r.month === '2026-08')).toBe(true);
  });

  it('throws when the rows sum to more than 100% (the save-time guard, not just a UI check)', () => {
    const rows = [{ categoryId: '1', percentage: 70 }, { categoryId: '2', percentage: 40 }];
    expect(() => saveAllocations(120000, rows, '2026-08')).toThrow();
  });

  it('allows exactly 100%', () => {
    const rows = [{ categoryId: '1', percentage: 100 }];
    expect(() => saveAllocations(120000, rows, '2026-08')).not.toThrow();
  });

  it('computes a correct amount from a fractional percentage', () => {
    const rows = [{ categoryId: '1', percentage: 4.5 }];
    const result = saveAllocations(120000, rows, '2026-08');
    expect(result[0].amount).toBe(5400);
    expect(result[0].percentage).toBe(4.5);
  });

  it('does not false-positive throw on fractional rows landing on exactly 100% (float drift)', () => {
    const rows = [{ categoryId: '1', percentage: 33.3 }, { categoryId: '2', percentage: 33.3 }, { categoryId: '3', percentage: 33.4 }];
    expect(() => saveAllocations(120000, rows, '2026-08')).not.toThrow();
  });

  it('stamps both updatedAt and createdAt with the given timestamp (merge priority and the sync pending-change indicator rely on these separately)', () => {
    const rows = [{ categoryId: '1', percentage: 25 }];
    const result = saveAllocations(120000, rows, '2026-08', 12345);
    expect(result[0].updatedAt).toBe(12345);
    expect(result[0].createdAt).toBe(12345);
  });
});

describe('sanitizePercentageInput', () => {
  it('strips non-numeric characters', () => {
    expect(sanitizePercentageInput('abc4.5xyz')).toBe('4.5');
  });

  it('preserves a trailing decimal point mid-typing', () => {
    expect(sanitizePercentageInput('4.')).toBe('4.');
  });

  it('collapses a second decimal point rather than allowing it', () => {
    expect(sanitizePercentageInput('4..5.6')).toBe('4.56');
  });

  it('caps fractional digits at 2, matching this module\'s 2dp precision elsewhere', () => {
    expect(sanitizePercentageInput('4.56789')).toBe('4.56');
  });

  it('passes an empty string through unchanged', () => {
    expect(sanitizePercentageInput('')).toBe('');
  });

  it('strips a minus sign (no negative percentages)', () => {
    expect(sanitizePercentageInput('-4.5')).toBe('4.5');
  });
});

describe('parsePercentageInput', () => {
  it('parses a valid decimal string', () => {
    expect(parsePercentageInput('4.5')).toBe(4.5);
  });

  it('parses a trailing-dot string as its integer value', () => {
    expect(parsePercentageInput('4.')).toBe(4);
  });

  it('defaults empty input to 0', () => {
    expect(parsePercentageInput('')).toBe(0);
  });

  it('defaults invalid input to 0', () => {
    expect(parsePercentageInput('abc')).toBe(0);
  });

  it('never returns negative', () => {
    expect(parsePercentageInput('-5')).toBe(0);
  });

  it('half-up rounds to 2dp even if handed more precision than sanitizePercentageInput would allow', () => {
    expect(parsePercentageInput('4.567')).toBe(4.57);
  });
});

describe('ensureMonthSeeded', () => {
  it('copies the previous month allocations forward when the target month has none', () => {
    const existing = [
      { id: 'a1', categoryId: '1', month: '2026-07', percentage: 25, amount: 30000 },
      { id: 'a2', categoryId: '2', month: '2026-07', percentage: 8, amount: 9600 },
    ];
    const result = ensureMonthSeeded(existing, '2026-08');
    const augRows = result.filter((r) => r.month === '2026-08');
    expect(augRows).toHaveLength(2);
    expect(augRows.map((r) => r.percentage).sort((a, b) => a - b)).toEqual([8, 25]);
    // new rows get fresh ids, distinct from the July originals
    expect(augRows.every((r) => !existing.some((e) => e.id === r.id))).toBe(true);
  });

  it('is a no-op if the target month already has rows', () => {
    const existing = [{ id: 'a1', categoryId: '1', month: '2026-08', percentage: 50, amount: 60000 }];
    const result = ensureMonthSeeded(existing, '2026-08');
    expect(result).toEqual(existing);
  });

  it('is a no-op if the previous month has no rows to copy (e.g. before onboarding)', () => {
    const result = ensureMonthSeeded([], '2026-08');
    expect(result).toEqual([]);
  });

  it('carries the source updatedAt forward (for merge priority) but always stamps a fresh createdAt (the row id itself is new)', () => {
    const existing = [{ id: 'a1', categoryId: '1', month: '2026-07', percentage: 25, amount: 30000, updatedAt: 1000, createdAt: 1000 }];
    const result = ensureMonthSeeded(existing, '2026-08', 9000);
    const augRow = result.find((r) => r.month === '2026-08');
    expect(augRow.updatedAt).toBe(1000);
    expect(augRow.createdAt).toBe(9000);
  });

  it('falls back createdAt to now for a source row with no createdAt (pre-sync data)', () => {
    const existing = [{ id: 'a1', categoryId: '1', month: '2026-07', percentage: 25, amount: 30000 }];
    const result = ensureMonthSeeded(existing, '2026-08', 9000);
    expect(result.find((r) => r.month === '2026-08').createdAt).toBe(9000);
  });
});
