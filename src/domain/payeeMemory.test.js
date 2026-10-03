import { describe, it, expect } from 'vitest';
import { payeeMemoryKey, learnPayeeCategories, prefillAssignments } from './payeeMemory.js';

const row = (over) => ({
  externalId: over.externalId, date: '2026-10-01', time: '10:00', amount: 100, direction: 'debit',
  payee: 'Shop', rawDescription: '', ...over,
});

const state = {
  categories: [
    { id: 'food', type: 'budget', name: 'Food', group: 'needs', archived: false },
    { id: 'old', type: 'budget', name: 'Old', group: 'wants', archived: true },
    { id: 'trip', type: 'quest', name: 'Trip', questStatus: 'active' },
    { id: 'done', type: 'quest', name: 'Done', questStatus: 'redeemed' },
  ],
  incomeCategories: [{ id: 'salary', name: 'Salary' }],
};

describe('payeeMemoryKey', () => {
  it('keys by direction plus normalized payee', () => {
    expect(payeeMemoryKey(row({ payee: 'Mr. Ravi  KUMAR' }))).toBe('debit:ravi kumar');
    expect(payeeMemoryKey(row({ payee: 'Ravi Kumar', direction: 'credit' }))).toBe('credit:ravi kumar');
  });
});

describe('learnPayeeCategories', () => {
  it('records each included row, newest statement row winning, skipping skipped rows', () => {
    const rows = [
      row({ externalId: 'new', payee: 'Shop', date: '2026-10-03' }),
      row({ externalId: 'old', payee: 'SHOP', date: '2026-10-01' }),
      row({ externalId: 'skipped', payee: 'Cafe' }),
      row({ externalId: 'boss', payee: 'Boss', direction: 'credit' }),
    ];
    const assignments = {
      new: { type: 'expense', categoryId: 'food', skip: false },
      old: { type: 'quest_contribution', categoryId: 'trip', skip: false },
      skipped: { type: 'expense', categoryId: 'food', skip: true },
      boss: { type: 'income', categoryId: 'salary', skip: false },
    };
    const map = learnPayeeCategories({ 'debit:other': { type: 'expense', categoryId: 'x', updatedAt: 1 } }, rows, assignments, 500);
    expect(map).toEqual({
      'debit:other': { type: 'expense', categoryId: 'x', updatedAt: 1 },
      'debit:shop': { type: 'expense', categoryId: 'food', updatedAt: 500 },
      'credit:boss': { type: 'income', categoryId: 'salary', updatedAt: 500 },
    });
  });

  it('overwrites an older entry for the same payee (latest choice wins)', () => {
    const map = learnPayeeCategories(
      { 'debit:shop': { type: 'expense', categoryId: 'old', updatedAt: 1 } },
      [row({ externalId: 'a' })],
      { a: { type: 'expense', categoryId: 'food', skip: false } },
      9,
    );
    expect(map['debit:shop']).toEqual({ type: 'expense', categoryId: 'food', updatedAt: 9 });
  });

  it('ignores payees that normalize to nothing', () => {
    const map = learnPayeeCategories({}, [row({ externalId: 'a', payee: '...' })], { a: { type: 'expense', categoryId: 'food', skip: false } }, 1);
    expect(map).toEqual({});
  });
});

describe('prefillAssignments', () => {
  it('prefills from memory, and ignores entries whose category is no longer selectable', () => {
    const rows = [
      row({ externalId: 'a', payee: 'Shop' }),
      row({ externalId: 'b', payee: 'Archived Place' }),
      row({ externalId: 'c', payee: 'Done Quest' }),
      row({ externalId: 'd', payee: 'Deleted' }),
      row({ externalId: 'e', payee: 'Boss', direction: 'credit' }),
      row({ externalId: 'f', payee: 'Unknown' }),
      row({ externalId: 'g', payee: 'Saver' }),
    ];
    const map = {
      'debit:shop': { type: 'expense', categoryId: 'food', updatedAt: 1 },
      'debit:archived place': { type: 'expense', categoryId: 'old', updatedAt: 1 },
      'debit:done quest': { type: 'quest_contribution', categoryId: 'done', updatedAt: 1 },
      'debit:deleted': { type: 'expense', categoryId: 'gone', updatedAt: 1 },
      'credit:boss': { type: 'income', categoryId: 'salary', updatedAt: 1 },
      'debit:saver': { type: 'quest_contribution', categoryId: 'trip', updatedAt: 1 },
    };
    expect(prefillAssignments(rows, map, state)).toEqual({
      a: { type: 'expense', categoryId: 'food', skip: false },
      b: { type: 'expense', categoryId: null, skip: false },
      c: { type: 'expense', categoryId: null, skip: false },
      d: { type: 'expense', categoryId: null, skip: false },
      e: { type: 'income', categoryId: 'salary', skip: false },
      f: { type: 'expense', categoryId: null, skip: false },
      g: { type: 'quest_contribution', categoryId: 'trip', skip: false },
    });
  });

  it('ignores a cleared (undone) entry', () => {
    const map = { 'debit:shop': { type: null, categoryId: null, updatedAt: 9 } };
    expect(prefillAssignments([row({ externalId: 'a' })], map, state).a).toEqual({ type: 'expense', categoryId: null, skip: false });
  });

  it('treats a missing map as empty', () => {
    expect(prefillAssignments([row({ externalId: 'a' })], undefined, state).a.categoryId).toBeNull();
  });
});
