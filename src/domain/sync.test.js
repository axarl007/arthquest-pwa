import { describe, it, expect } from 'vitest';
import { mergeState } from './sync.js';
import { ensureMonthSeeded, saveAllocations } from './allocations.js';
import { cumulativePosition } from './transactions.js';

const tx = (id, over = {}) => ({
  id, type: 'expense', amount: 100, date: '2026-08-01', createdAt: 1000, categoryId: 'cat1',
  incomeCategoryId: null, description: '', isRedemption: false, deletedAt: null, ...over,
});

const cat = (id, over = {}) => ({
  id, name: 'Groceries', icon: 'shopping_cart', type: 'budget', group: 'needs', archived: false,
  archivedAt: null, color: '#000', questTargetAmount: null, questTargetDate: null, questStatus: null,
  questRedeemedDate: null, ...over,
});

const quest = (id, over = {}) => cat(id, {
  type: 'quest', group: 'savings', questTargetAmount: 1000, questTargetDate: '2026-12-31',
  questStatus: 'active', ...over,
});

const income = (id, over = {}) => ({ id, name: 'Salary', icon: 'work', color: '#111', ...over });

const alloc = (id, over = {}) => ({ id, categoryId: 'cat1', month: '2026-08', percentage: 25, amount: 30000, updatedAt: 1000, ...over });

const state = (over = {}) => ({ transactions: [], categories: [], incomeCategories: [], budgetAllocations: [], ...over });

describe('mergeState — transactions', () => {
  it('unions transactions present on only one side', () => {
    const local = state({ transactions: [tx('t1')] });
    const remote = state({ transactions: [tx('t2')] });
    const result = mergeState(local, remote);
    expect(result.transactions.map((t) => t.id).sort()).toEqual(['t1', 't2']);
  });

  it('keeps a transaction deleted locally even though the remote copy has no tombstone yet (resurrection regression)', () => {
    const local = state({ transactions: [tx('t1', { deletedAt: 5000 })] });
    const remote = state({ transactions: [tx('t1', { deletedAt: null })] });
    const result = mergeState(local, remote);
    expect(result.transactions.find((t) => t.id === 't1').deletedAt).toBe(5000);
  });

  it('keeps a transaction deleted remotely even though the local copy has no tombstone (symmetric)', () => {
    const local = state({ transactions: [tx('t1', { deletedAt: null })] });
    const remote = state({ transactions: [tx('t1', { deletedAt: 7000 })] });
    const result = mergeState(local, remote);
    expect(result.transactions.find((t) => t.id === 't1').deletedAt).toBe(7000);
  });

  it('when both sides tombstoned the same id, keeps the earlier deletedAt deterministically regardless of argument order', () => {
    const a = state({ transactions: [tx('t1', { deletedAt: 9000 })] });
    const b = state({ transactions: [tx('t1', { deletedAt: 3000 })] });
    expect(mergeState(a, b).transactions[0].deletedAt).toBe(3000);
    expect(mergeState(b, a).transactions[0].deletedAt).toBe(3000);
  });

  it('never duplicates a transaction id present on both sides', () => {
    const local = state({ transactions: [tx('t1')] });
    const remote = state({ transactions: [tx('t1')] });
    expect(mergeState(local, remote).transactions).toHaveLength(1);
  });
});

describe('mergeState — categories (archived)', () => {
  it('a real toggle beats a never-touched null archivedAt, regardless of which side', () => {
    const local = state({ categories: [cat('c1', { archived: false, archivedAt: null })] });
    const remote = state({ categories: [cat('c1', { archived: true, archivedAt: 4000 })] });
    expect(mergeState(local, remote).categories[0].archived).toBe(true);
    expect(mergeState(remote, local).categories[0].archived).toBe(true);
  });

  it('the later archivedAt wins when both sides toggled', () => {
    const local = state({ categories: [cat('c1', { archived: true, archivedAt: 2000 })] });
    const remote = state({ categories: [cat('c1', { archived: false, archivedAt: 8000 })] });
    expect(mergeState(local, remote).categories[0].archived).toBe(false);
    expect(mergeState(local, remote).categories[0].archivedAt).toBe(8000);
  });

  it('on an exact archivedAt tie, archived:true wins deterministically regardless of order', () => {
    const local = state({ categories: [cat('c1', { archived: true, archivedAt: 5000 })] });
    const remote = state({ categories: [cat('c1', { archived: false, archivedAt: 5000 })] });
    expect(mergeState(local, remote).categories[0].archived).toBe(true);
    expect(mergeState(remote, local).categories[0].archived).toBe(true);
  });

  it('unions categories present on only one side', () => {
    const local = state({ categories: [cat('c1')] });
    const remote = state({ categories: [cat('c2')] });
    expect(mergeState(local, remote).categories.map((c) => c.id).sort()).toEqual(['c1', 'c2']);
  });
});

describe('mergeState — quest status', () => {
  it('recomputes status from merged transactions — a contribution logged only on the remote device can complete a quest', () => {
    const local = state({
      categories: [quest('q1', { questTargetAmount: 1000, questStatus: 'active' })],
      transactions: [{ ...tx('t1', { type: 'quest_contribution', categoryId: 'q1', amount: 400 }) }],
    });
    const remote = state({
      categories: [quest('q1', { questTargetAmount: 1000, questStatus: 'active' })],
      transactions: [{ ...tx('t2', { type: 'quest_contribution', categoryId: 'q1', amount: 700 }) }],
    });
    const result = mergeState(local, remote);
    const merged = result.categories.find((c) => c.id === 'q1');
    expect(merged.questStatus).toBe('completed');
  });

  it('redeemed is terminal — stays redeemed even if the other side still shows active (no resurrection of a redeemed quest)', () => {
    const local = state({ categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-05' })] });
    const remote = state({ categories: [quest('q1', { questStatus: 'active', questRedeemedDate: null })] });
    const result = mergeState(local, remote);
    expect(result.categories[0].questStatus).toBe('redeemed');
    expect(result.categories[0].questRedeemedDate).toBe('2026-08-05');

    const reversed = mergeState(remote, local);
    expect(reversed.categories[0].questStatus).toBe('redeemed');
    expect(reversed.categories[0].questRedeemedDate).toBe('2026-08-05');
  });

  it('drops back to active if the merged contributions no longer reach the target (a contribution was deleted on one side)', () => {
    const local = state({
      categories: [quest('q1', { questTargetAmount: 1000, questStatus: 'completed' })],
      transactions: [tx('t1', { type: 'quest_contribution', categoryId: 'q1', amount: 1000, deletedAt: 9000 })],
    });
    const remote = state({
      categories: [quest('q1', { questTargetAmount: 1000, questStatus: 'completed' })],
      transactions: [tx('t1', { type: 'quest_contribution', categoryId: 'q1', amount: 1000, deletedAt: null })],
    });
    const result = mergeState(local, remote);
    expect(result.categories[0].questStatus).toBe('active');
  });
});

describe('mergeState — concurrent quest redemption', () => {
  it('keeps only one redemption transaction when both devices redeemed the same quest offline, and does not double-count the withdrawal', () => {
    const local = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-05' })],
      transactions: [tx('tA', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-05', createdAt: 5000 })],
    });
    const remote = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-03' })],
      transactions: [tx('tB', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-03', createdAt: 3000 })],
    });
    const result = mergeState(local, remote);
    const activeRedemptions = result.transactions.filter((t) => t.isRedemption && !t.deletedAt);
    expect(activeRedemptions).toHaveLength(1);
    expect(activeRedemptions[0].id).toBe('tB'); // earlier date wins
    expect(cumulativePosition(result.transactions)).toBe(-1000); // not -2000
    expect(result.categories[0].questRedeemedDate).toBe('2026-08-03');
  });

  it('still tombstones the losing redemption even when its createdAt is falsy (legacy/hand-edited import data)', () => {
    const local = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-05' })],
      transactions: [tx('tA', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-05', createdAt: undefined })],
    });
    const remote = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-03' })],
      transactions: [tx('tB', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-03', createdAt: 3000 })],
    });
    const result = mergeState(local, remote);
    const activeRedemptions = result.transactions.filter((t) => t.isRedemption && !t.deletedAt);
    expect(activeRedemptions).toHaveLength(1);
    expect(cumulativePosition(result.transactions)).toBe(-1000);
  });

  it('picks the same surviving redemption and questRedeemedDate regardless of which side is local vs remote', () => {
    const local = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-05' })],
      transactions: [tx('tA', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-05', createdAt: 5000 })],
    });
    const remote = state({
      categories: [quest('q1', { questStatus: 'redeemed', questRedeemedDate: '2026-08-03' })],
      transactions: [tx('tB', { type: 'expense', categoryId: 'q1', amount: 1000, isRedemption: true, date: '2026-08-03', createdAt: 3000 })],
    });
    const byId = (items) => [...items].sort((x, y) => (x.id < y.id ? -1 : 1));
    const forward = mergeState(local, remote);
    const reversed = mergeState(remote, local);
    expect(byId(forward.transactions)).toEqual(byId(reversed.transactions));
    expect(byId(forward.categories)).toEqual(byId(reversed.categories));
  });
});

describe('mergeState — budgetAllocations vs the mechanical month-copy race (ensureMonthSeeded)', () => {
  it('a genuine edit on one device is not reverted by the other device merely opening the new month afterward', () => {
    // Both devices start synced through July with the same allocation for Groceries.
    const julyRow = { id: 'jul1', categoryId: 'c1', month: '2026-07', percentage: 25, amount: 30000, updatedAt: 1000 };

    // Device B, offline, deliberately edits August to 40%.
    const deviceBAugust = saveAllocations(120000, [{ categoryId: 'c1', percentage: 40 }], '2026-08', 2000);

    // Device A, offline, merely opens the Budget tab for August (no edit) — much later in wall
    // clock time, but a mechanical copy-forward, not a real change.
    const deviceAAugust = ensureMonthSeeded([julyRow], '2026-08', 9000);

    const local = state({ budgetAllocations: deviceAAugust });
    const remote = state({ budgetAllocations: [julyRow, ...deviceBAugust] });
    const result = mergeState(local, remote);

    const augustRows = result.budgetAllocations.filter((r) => r.month === '2026-08');
    expect(augustRows).toHaveLength(1);
    expect(augustRows[0].percentage).toBe(40);
  });
});

describe('mergeState — income categories', () => {
  it('unions income categories present on only one side', () => {
    const local = state({ incomeCategories: [income('i1')] });
    const remote = state({ incomeCategories: [income('i2')] });
    expect(mergeState(local, remote).incomeCategories.map((c) => c.id).sort()).toEqual(['i1', 'i2']);
  });

  it('never duplicates an income category id present on both sides', () => {
    const local = state({ incomeCategories: [income('i1')] });
    const remote = state({ incomeCategories: [income('i1')] });
    expect(mergeState(local, remote).incomeCategories).toHaveLength(1);
  });
});

describe('mergeState — budgetAllocations', () => {
  it('unions allocation rows for different (categoryId, month) keys', () => {
    const local = state({ budgetAllocations: [alloc('a1', { categoryId: 'c1', month: '2026-08' })] });
    const remote = state({ budgetAllocations: [alloc('a2', { categoryId: 'c2', month: '2026-08' })] });
    expect(mergeState(local, remote).budgetAllocations).toHaveLength(2);
  });

  it('keeps only one row per (categoryId, month) when both sides independently replaced it — the more recently updated one wins', () => {
    const local = state({ budgetAllocations: [alloc('a1', { categoryId: 'c1', month: '2026-08', percentage: 25, updatedAt: 1000 })] });
    const remote = state({ budgetAllocations: [alloc('a2', { categoryId: 'c1', month: '2026-08', percentage: 40, updatedAt: 5000 })] });
    const result = mergeState(local, remote);
    const rows = result.budgetAllocations.filter((r) => r.categoryId === 'c1' && r.month === '2026-08');
    expect(rows).toHaveLength(1);
    expect(rows[0].percentage).toBe(40);
    expect(rows[0].id).toBe('a2');
  });

  it('a row with no updatedAt (pre-sync data) is treated as maximally stale and always loses', () => {
    const local = state({ budgetAllocations: [{ id: 'a1', categoryId: 'c1', month: '2026-08', percentage: 25, amount: 30000 }] });
    const remote = state({ budgetAllocations: [alloc('a2', { categoryId: 'c1', month: '2026-08', percentage: 40, updatedAt: 1 })] });
    const result = mergeState(local, remote);
    expect(result.budgetAllocations).toHaveLength(1);
    expect(result.budgetAllocations[0].id).toBe('a2');
  });

  it('on an exact updatedAt tie, the lexicographically smaller id wins deterministically regardless of order', () => {
    const local = state({ budgetAllocations: [alloc('aaa', { categoryId: 'c1', month: '2026-08', updatedAt: 3000 })] });
    const remote = state({ budgetAllocations: [alloc('zzz', { categoryId: 'c1', month: '2026-08', updatedAt: 3000 })] });
    expect(mergeState(local, remote).budgetAllocations[0].id).toBe('aaa');
    expect(mergeState(remote, local).budgetAllocations[0].id).toBe('aaa');
  });
});

describe('mergeState — determinism and idempotency', () => {
  it('produces the same merged transactions/categories regardless of which side is passed as local vs remote', () => {
    const a = state({
      transactions: [tx('t1', { deletedAt: 4000 })],
      categories: [cat('c1', { archived: true, archivedAt: 6000 })],
    });
    const b = state({
      transactions: [tx('t1', { deletedAt: null })],
      categories: [cat('c1', { archived: false, archivedAt: 2000 })],
    });
    const ab = mergeState(a, b);
    const ba = mergeState(b, a);
    expect(ab.transactions).toEqual(ba.transactions);
    expect(ab.categories).toEqual(ba.categories);
    expect(ab.budgetAllocations).toEqual(ba.budgetAllocations);
  });

  it('merging an already-merged result back in with the same remote produces the same result again (idempotent)', () => {
    const local = state({
      transactions: [tx('t1'), tx('t2', { deletedAt: 5000 })],
      categories: [cat('c1', { archived: true, archivedAt: 3000 })],
      incomeCategories: [income('i1')],
      budgetAllocations: [alloc('a1', { updatedAt: 2000 })],
    });
    const remote = state({
      transactions: [tx('t2', { deletedAt: null }), tx('t3')],
      categories: [cat('c1', { archived: false, archivedAt: 1000 }), cat('c2')],
      incomeCategories: [income('i2')],
      budgetAllocations: [alloc('a2', { updatedAt: 6000 })],
    });
    const once = mergeState(local, remote);
    const twice = mergeState(once, remote);
    expect(twice).toEqual(once);
  });
});
