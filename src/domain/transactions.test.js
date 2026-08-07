import { describe, it, expect } from 'vitest';
import {
  monthKeyOfDate,
  transactionsInMonth,
  monthlyTotals,
  spentForCategory,
  contributedForQuest,
  sortTransactions,
  filterByType,
  groupByDateLabel,
  resolveTransactionSubject,
} from './transactions.js';

const tx = (over) => ({
  id: over.id, type: 'expense', amount: 100, date: '2026-08-01', createdAt: 0,
  categoryId: null, incomeCategoryId: null, description: '', isRedemption: false, ...over,
});

describe('monthKeyOfDate', () => {
  it('extracts YYYY-MM from an ISO date', () => {
    expect(monthKeyOfDate('2026-08-15')).toBe('2026-08');
  });
});

describe('transactionsInMonth', () => {
  it('filters to only the given month', () => {
    const list = [tx({ id: '1', date: '2026-08-01' }), tx({ id: '2', date: '2026-07-31' })];
    expect(transactionsInMonth(list, '2026-08').map((t) => t.id)).toEqual(['1']);
  });
});

describe('monthlyTotals', () => {
  it('sums income, expense, and quest contributions separately, and computes net', () => {
    const list = [
      tx({ id: '1', type: 'income', amount: 120000, date: '2026-08-01' }),
      tx({ id: '2', type: 'expense', amount: 30000, date: '2026-08-02' }),
      tx({ id: '3', type: 'quest_contribution', amount: 8000, date: '2026-08-03' }),
      tx({ id: '4', type: 'expense', amount: 50, date: '2026-07-31' }), // different month, excluded
    ];
    const totals = monthlyTotals(list, '2026-08');
    expect(totals).toEqual({ income: 120000, expense: 30000, questContribution: 8000, net: 82000 });
  });
});

describe('spentForCategory', () => {
  it('sums only EXPENSE transactions for the given category and month', () => {
    const list = [
      tx({ id: '1', categoryId: 'c1', amount: 4200, date: '2026-08-05' }),
      tx({ id: '2', categoryId: 'c1', amount: 2000, date: '2026-08-18' }),
      tx({ id: '3', categoryId: 'c2', amount: 999, date: '2026-08-05' }),
      tx({ id: '4', categoryId: 'c1', amount: 500, date: '2026-07-05' }),
      tx({ id: '5', categoryId: 'c1', type: 'quest_contribution', amount: 999, date: '2026-08-05' }),
    ];
    expect(spentForCategory(list, 'c1', '2026-08')).toBe(6200);
  });
});

describe('contributedForQuest', () => {
  it('sums all-time QUEST_CONTRIBUTION transactions for the quest, ignoring month', () => {
    const list = [
      tx({ id: '1', type: 'quest_contribution', categoryId: 'q1', amount: 8000, date: '2026-05-10' }),
      tx({ id: '2', type: 'quest_contribution', categoryId: 'q1', amount: 8000, date: '2026-07-14' }),
      tx({ id: '3', type: 'quest_contribution', categoryId: 'q2', amount: 500, date: '2026-08-01' }),
      tx({ id: '4', type: 'expense', categoryId: 'q1', amount: 1, date: '2026-08-01' }),
    ];
    expect(contributedForQuest(list, 'q1')).toBe(16000);
  });
});

describe('sortTransactions', () => {
  const list = [tx({ id: 'a', date: '2026-08-01' }), tx({ id: 'b', date: '2026-08-15' }), tx({ id: 'c', date: '2026-08-08' })];

  it('sorts descending by date by default', () => {
    expect(sortTransactions(list, 'desc').map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts ascending', () => {
    expect(sortTransactions(list, 'asc').map((t) => t.id)).toEqual(['a', 'c', 'b']);
  });

  it('tie-breaks same-day transactions by creation order, not id, so the just-saved one sorts last-in-desc-first', () => {
    const sameDay = [
      tx({ id: 'z-first-saved', date: '2026-08-07', createdAt: 100 }),
      tx({ id: 'a-second-saved', date: '2026-08-07', createdAt: 200 }),
    ];
    expect(sortTransactions(sameDay, 'desc').map((t) => t.id)).toEqual(['a-second-saved', 'z-first-saved']);
  });
});

describe('filterByType', () => {
  const list = [tx({ id: '1', type: 'income' }), tx({ id: '2', type: 'expense' }), tx({ id: '3', type: 'quest_contribution' })];

  it('returns everything for "all"', () => {
    expect(filterByType(list, 'all')).toHaveLength(3);
  });

  it('filters to a specific type', () => {
    expect(filterByType(list, 'income').map((t) => t.id)).toEqual(['1']);
  });
});

describe('groupByDateLabel', () => {
  it('groups consecutive-in-list transactions sharing a date label together, preserving list order', () => {
    const list = [
      tx({ id: '1', date: '2026-08-07' }), // Today
      tx({ id: '2', date: '2026-08-07' }), // Today
      tx({ id: '3', date: '2026-08-06' }), // Yesterday
    ];
    const groups = groupByDateLabel(list, '2026-08-07');
    expect(groups).toEqual([
      { label: 'Today, 7 Aug', items: [list[0], list[1]] },
      { label: 'Yesterday, 6 Aug', items: [list[2]] },
    ]);
  });
});

describe('resolveTransactionSubject', () => {
  const categories = [
    { id: 'c1', name: 'Groceries', icon: 'shopping_cart', type: 'budget', color: 'oklch(0.62 0.13 150)' },
    { id: 'q1', name: 'Goa Trip', icon: 'flag', type: 'quest' },
  ];
  const incomeCategories = [{ id: 'ic1', name: 'Salary', icon: 'work', color: 'oklch(0.62 0.13 28)' }];
  const C = { accent: 'ACCENT', quest: 'QUEST', income: 'INCOME', expense: 'EXPENSE' };

  it('resolves an income transaction to its income category, colored by the fixed accent (not the income category\'s own color)', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'income', incomeCategoryId: 'ic1' }), categories, incomeCategories, C);
    expect(r).toEqual({ name: 'Salary', icon: 'work', kind: 'income', color: 'ACCENT' });
  });

  it('falls back to "Income" if the income category no longer exists', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'income', incomeCategoryId: 'gone' }), categories, incomeCategories, C);
    expect(r.name).toBe('Income');
  });

  it('resolves a quest contribution to its quest, colored by the fixed quest accent', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'quest_contribution', categoryId: 'q1' }), categories, incomeCategories, C);
    expect(r).toEqual({ name: 'Goa Trip', icon: 'flag', kind: 'quest', color: 'QUEST' });
  });

  it('resolves a redemption expense to "<quest> redeemed", colored gold', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'expense', categoryId: 'q1', isRedemption: true }), categories, incomeCategories, C);
    expect(r).toEqual({ name: 'Goa Trip redeemed', icon: 'redeem', kind: 'redemption', color: 'oklch(0.8 0.13 85)' });
  });

  it('resolves a plain expense to its budget category, colored by that category\'s own persisted color', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'expense', categoryId: 'c1' }), categories, incomeCategories, C);
    expect(r).toEqual({ name: 'Groceries', icon: 'shopping_cart', kind: 'expense', color: 'oklch(0.62 0.13 150)' });
  });

  it('falls back to "Other" with a neutral color if the expense category no longer exists', () => {
    const r = resolveTransactionSubject(tx({ id: '1', type: 'expense', categoryId: 'gone' }), categories, incomeCategories, C);
    expect(r.name).toBe('Other');
    expect(r.color).toBe('oklch(0.5 0.02 265)');
  });
});
