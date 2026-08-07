import { describe, it, expect } from 'vitest';
import {
  buildOnboardingRows,
  allocationTotals,
  saveAllocations,
  ensureMonthSeeded,
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
});
