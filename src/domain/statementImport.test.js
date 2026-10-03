import { describe, it, expect } from 'vitest';
import {
  normalizePayee,
  defaultTypeForDirection,
  prepareReview,
  groupRowsByPayee,
  initialAssignments,
  unassignedRowIds,
  buildImportTransactions,
  applyImportedTransactions,
} from './statementImport.js';
import { categoryOptionsForType } from './categoryOptions.js';

const row = (over) => ({
  externalId: over.externalId, date: '2026-10-01', time: '10:00', amount: 100, direction: 'debit',
  payee: 'Shop', rawDescription: 'Paid to Shop', ...over,
});

const state = {
  categories: [
    { id: 'food', type: 'budget', name: 'Food', icon: 'restaurant', color: '#f00', group: 'needs', archived: false },
    { id: 'old', type: 'budget', name: 'Old', icon: 'x', color: '#0f0', group: 'wants', archived: true },
    { id: 'trip', type: 'quest', name: 'Trip', icon: 'flight', color: '#00f', questStatus: 'active', questTargetAmount: 1000 },
    { id: 'done', type: 'quest', name: 'Done', icon: 'flag', color: '#00f', questStatus: 'redeemed', questTargetAmount: 10 },
  ],
  incomeCategories: [{ id: 'salary', name: 'Salary', icon: 'work', color: '#ff0' }],
  transactions: [],
};

describe('normalizePayee', () => {
  it('lowercases, strips honorifics/punctuation and collapses whitespace', () => {
    expect(normalizePayee('  Mr. DEEPAK   Kumar G ')).toBe('deepak kumar g');
    expect(normalizePayee('Mrs Asha Rao')).toBe('asha rao');
    expect(normalizePayee('Home Centre')).toBe('home centre');
  });
  it('does not strip honorific-like prefixes inside words', () => {
    expect(normalizePayee('Mrinal Store')).toBe('mrinal store');
  });
});

describe('defaultTypeForDirection', () => {
  it('maps debit to expense and credit to income', () => {
    expect(defaultTypeForDirection('debit')).toBe('expense');
    expect(defaultTypeForDirection('credit')).toBe('income');
  });
});

describe('prepareReview', () => {
  it('hides rows already imported as non-deleted transactions, and in-file duplicates', () => {
    const transactions = [
      { id: 't1', externalId: 'phonepe:A', deletedAt: null },
      { id: 't2', externalId: 'phonepe:B', deletedAt: 123 },
    ];
    const rows = [row({ externalId: 'phonepe:A' }), row({ externalId: 'phonepe:B' }), row({ externalId: 'phonepe:C' }), row({ externalId: 'phonepe:C' })];
    const result = prepareReview(rows, transactions);
    expect(result.rows.map((r) => r.externalId)).toEqual(['phonepe:B', 'phonepe:C']);
    expect(result.alreadyImportedCount).toBe(1);
  });
});

describe('groupRowsByPayee', () => {
  it('groups by normalized payee and direction, in first-appearance order', () => {
    const rows = [
      row({ externalId: '1', payee: 'Mr Ravi' }),
      row({ externalId: '2', payee: 'Shop' }),
      row({ externalId: '3', payee: 'RAVI' }),
      row({ externalId: '4', payee: 'Ravi', direction: 'credit' }),
    ];
    const groups = groupRowsByPayee(rows);
    expect(groups.map((g) => [g.payee, g.direction, g.rows.map((r) => r.externalId)])).toEqual([
      ['Mr Ravi', 'debit', ['1', '3']],
      ['Shop', 'debit', ['2']],
      ['Ravi', 'credit', ['4']],
    ]);
    expect(groups[0].total).toBe(200);
  });
});

describe('initialAssignments / unassignedRowIds', () => {
  it('defaults each row to its direction type with no category', () => {
    const rows = [row({ externalId: 'a' }), row({ externalId: 'b', direction: 'credit' })];
    expect(initialAssignments(rows)).toEqual({
      a: { type: 'expense', categoryId: null, skip: false },
      b: { type: 'income', categoryId: null, skip: false },
    });
  });

  it('lists included rows without a currently-valid category, in row order', () => {
    const rows = [row({ externalId: 'a' }), row({ externalId: 'b' }), row({ externalId: 'c' }), row({ externalId: 'd' }), row({ externalId: 'e' })];
    const assignments = {
      a: { type: 'expense', categoryId: 'food', skip: false },
      b: { type: 'expense', categoryId: null, skip: false },
      c: { type: 'expense', categoryId: null, skip: true },
      d: { type: 'expense', categoryId: 'old', skip: false }, // archived — not selectable
      e: { type: 'income', categoryId: 'food', skip: false }, // wrong type for this id
    };
    expect(unassignedRowIds(rows, assignments, state)).toEqual(['b', 'd', 'e']);
  });
});

describe('categoryOptionsForType', () => {
  it('matches LogTransactionSheet filtering', () => {
    expect(categoryOptionsForType('expense', state).map((o) => o.id)).toEqual(['food']);
    expect(categoryOptionsForType('quest_contribution', state).map((o) => o.id)).toEqual(['trip']);
    expect(categoryOptionsForType('income', state).map((o) => o.id)).toEqual(['salary']);
  });
});

describe('buildImportTransactions', () => {
  it('builds transactions for included rows with createdAt ordered chronologically from `now`', () => {
    // Statement order is newest-first; the 09:00 and 18:00 rows share a date.
    const rows = [
      row({ externalId: 'late', date: '2026-10-02', time: '18:00', payee: 'Late', amount: 30 }),
      row({ externalId: 'skip', date: '2026-10-02', time: '12:00' }),
      row({ externalId: 'early', date: '2026-10-02', time: '09:00', payee: 'Early', amount: 20 }),
      row({ externalId: 'inc', date: '2026-10-01', time: '23:00', payee: 'Boss', amount: 1000, direction: 'credit' }),
      row({ externalId: 'q', date: '2026-10-01', time: '08:00', payee: 'Me', amount: 5 }),
    ];
    const assignments = {
      late: { type: 'expense', categoryId: 'food', skip: false },
      skip: { type: 'expense', categoryId: null, skip: true },
      early: { type: 'expense', categoryId: 'food', skip: false },
      inc: { type: 'income', categoryId: 'salary', skip: false },
      q: { type: 'quest_contribution', categoryId: 'trip', skip: false },
    };
    let n = 0;
    const txs = buildImportTransactions(rows, assignments, { now: 1000, makeId: () => `id${n++}` });
    const byExt = Object.fromEntries(txs.map((t) => [t.externalId, t]));
    expect(txs).toHaveLength(4);
    expect(byExt.late).toEqual({
      id: expect.any(String), type: 'expense', amount: 30, date: '2026-10-02', createdAt: 1003, description: 'Late',
      categoryId: 'food', incomeCategoryId: null, isRedemption: false, deletedAt: null, externalId: 'late',
    });
    expect(byExt.early.createdAt).toBe(1002);
    expect(byExt.inc).toMatchObject({ type: 'income', categoryId: null, incomeCategoryId: 'salary', createdAt: 1001 });
    expect(byExt.q).toMatchObject({ type: 'quest_contribution', categoryId: 'trip', createdAt: 1000 });
  });

  it('breaks identical date+time ties by statement position (later row = older)', () => {
    const rows = [row({ externalId: 'newer' }), row({ externalId: 'older' })];
    const a = { type: 'expense', categoryId: 'food', skip: false };
    const txs = buildImportTransactions(rows, { newer: a, older: a }, { now: 0, makeId: () => 'x' });
    expect(txs.find((t) => t.externalId === 'older').createdAt).toBeLessThan(txs.find((t) => t.externalId === 'newer').createdAt);
  });

  it('refuses to build when any included row is unassigned', () => {
    expect(() => buildImportTransactions([row({ externalId: 'a' })], { a: { type: 'expense', categoryId: null, skip: false } }, { now: 0, makeId: () => 'x' }))
      .toThrow();
  });
});

describe('applyImportedTransactions', () => {
  it('prepends transactions and recomputes every touched quest', () => {
    const imported = [{ id: 'n1', type: 'quest_contribution', amount: 1000, date: '2026-10-01', createdAt: 1, categoryId: 'trip', incomeCategoryId: null, description: '', isRedemption: false, deletedAt: null }];
    const patch = applyImportedTransactions(state, imported);
    expect(patch.transactions[0].id).toBe('n1');
    expect(patch.categories.find((c) => c.id === 'trip').questStatus).toBe('completed');
    expect(patch.categories.find((c) => c.id === 'food')).toBe(state.categories[0]);
  });

  it('leaves categories untouched when no quest is involved', () => {
    const patch = applyImportedTransactions(state, [{ id: 'n1', type: 'expense', amount: 1, categoryId: 'food' }]);
    expect(patch.categories).toBe(state.categories);
  });
});
