import { describe, it, expect } from 'vitest';
import { buildBudgetRows, matchesBudgetFilter, sortBudgetRows, isLockedMonth } from './budget.js';

const category = (over) => ({
  id: 'c1', name: 'Groceries', icon: 'shopping_cart', type: 'budget', group: 'needs',
  archived: false, color: 'oklch(0.62 0.13 150)', ...over,
});

const alloc = (over) => ({ id: 'a1', categoryId: 'c1', month: '2026-08', percentage: 8, amount: 8000, ...over });

const tx = (over) => ({
  id: over.id, type: 'expense', amount: 100, date: '2026-08-01', createdAt: 0,
  categoryId: 'c1', incomeCategoryId: null, description: '', isRedemption: false, ...over,
});

describe('buildBudgetRows', () => {
  it('excludes archived and quest-type categories', () => {
    const categories = [category({ id: 'c1' }), category({ id: 'c2', archived: true }), category({ id: 'c3', type: 'quest' })];
    const rows = buildBudgetRows(categories, [], [], '2026-08');
    expect(rows.map((r) => r.categoryId)).toEqual(['c1']);
  });

  it('joins this month\'s allocation and derives spend from transactions, ignoring other months', () => {
    const categories = [category()];
    const allocations = [alloc(), alloc({ id: 'a0', month: '2026-07', amount: 5000 })];
    const transactions = [
      tx({ id: 't1', amount: 3000, date: '2026-08-05' }),
      tx({ id: 't2', amount: 1000, date: '2026-08-20' }),
      tx({ id: 't3', amount: 999, date: '2026-07-20' }),
      tx({ id: 't4', amount: 999, type: 'quest_contribution', date: '2026-08-05' }),
    ];
    const [row] = buildBudgetRows(categories, allocations, transactions, '2026-08');
    expect(row.allocated).toBe(8000);
    expect(row.spent).toBe(4000);
  });

  it('has null percentUsed and 0 allocated when nothing is allocated', () => {
    const [row] = buildBudgetRows([category()], [], [], '2026-08');
    expect(row.allocated).toBe(0);
    expect(row.percentUsed).toBeNull();
  });

  describe('colorState thresholds (ported from BudgetViewModel.kt, not the 70%/100% mockup guess)', () => {
    it('is green under 80% used', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 7999 })], '2026-08');
      expect(row.colorState).toBe('green');
    });

    it('is yellow at exactly 80% used', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 8000 })], '2026-08');
      expect(row.colorState).toBe('yellow');
    });

    it('is yellow up to and including 100% used (not yet over)', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 10000 })], '2026-08');
      expect(row.colorState).toBe('yellow');
      expect(row.isOverBudget).toBe(false);
    });

    it('is red only once spend strictly exceeds allocation', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 10001 })], '2026-08');
      expect(row.colorState).toBe('red');
      expect(row.isOverBudget).toBe(true);
    });

    it('is red for any spend against a zero allocation', () => {
      const [row] = buildBudgetRows([category()], [], [tx({ amount: 1 })], '2026-08');
      expect(row.colorState).toBe('red');
    });
  });

  describe('isUnderused / isNotUsed', () => {
    it('isNotUsed when nothing spent', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [], '2026-08');
      expect(row.isNotUsed).toBe(true);
      expect(row.isUnderused).toBe(false);
    });

    it('isUnderused below 50% used with something spent', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 4999 })], '2026-08');
      expect(row.isUnderused).toBe(true);
    });

    it('is not underused at exactly 50% used', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 5000 })], '2026-08');
      expect(row.isUnderused).toBe(false);
    });
  });

  describe('progressFraction', () => {
    it('is capped at 1 when over budget', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 50000 })], '2026-08');
      expect(row.progressFraction).toBe(1);
    });

    it('reflects percentUsed/100 otherwise', () => {
      const [row] = buildBudgetRows([category()], [alloc({ amount: 10000 })], [tx({ amount: 2500 })], '2026-08');
      expect(row.progressFraction).toBe(0.25);
    });
  });
});

describe('matchesBudgetFilter', () => {
  const overRow = { isOverBudget: true, isUnderused: false, isNotUsed: false };
  const underRow = { isOverBudget: false, isUnderused: true, isNotUsed: false };
  const unusedRow = { isOverBudget: false, isUnderused: false, isNotUsed: true };

  it('"all" matches everything', () => {
    expect(matchesBudgetFilter(overRow, 'all')).toBe(true);
    expect(matchesBudgetFilter(unusedRow, 'all')).toBe(true);
  });

  it('"over" matches only over-budget rows', () => {
    expect(matchesBudgetFilter(overRow, 'over')).toBe(true);
    expect(matchesBudgetFilter(underRow, 'over')).toBe(false);
  });

  it('"under" matches only underused rows', () => {
    expect(matchesBudgetFilter(underRow, 'under')).toBe(true);
    expect(matchesBudgetFilter(overRow, 'under')).toBe(false);
  });

  it('"unused" matches only not-used rows', () => {
    expect(matchesBudgetFilter(unusedRow, 'unused')).toBe(true);
    expect(matchesBudgetFilter(underRow, 'unused')).toBe(false);
  });
});

describe('sortBudgetRows', () => {
  it('sorts by percentUsed descending by default, unallocated-but-spent rows outranking everything', () => {
    const rows = [
      { categoryId: 'a', sortKey: 50 },
      { categoryId: 'b', sortKey: Infinity },
      { categoryId: 'c', sortKey: 0 },
      { categoryId: 'd', sortKey: 90 },
    ];
    expect(sortBudgetRows(rows, 'desc').map((r) => r.categoryId)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('reverses for asc', () => {
    const rows = [{ categoryId: 'a', sortKey: 50 }, { categoryId: 'd', sortKey: 90 }];
    expect(sortBudgetRows(rows, 'asc').map((r) => r.categoryId)).toEqual(['a', 'd']);
  });
});

describe('isLockedMonth', () => {
  it('is true only for months strictly before the current month', () => {
    expect(isLockedMonth('2026-07', '2026-08')).toBe(true);
    expect(isLockedMonth('2026-08', '2026-08')).toBe(false);
    expect(isLockedMonth('2026-09', '2026-08')).toBe(false);
  });
});
