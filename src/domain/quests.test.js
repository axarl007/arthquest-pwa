import { describe, it, expect } from 'vitest';
import { createQuest, questProgress, questRows, recomputeQuestStatus, withRecomputedQuestStatus, redeemQuest } from './quests.js';

const quest = (over) => ({
  id: 'q1', name: 'Goa Trip', icon: 'flag', type: 'quest', group: 'savings', archived: false,
  color: 'oklch(0.62 0.13 300)', questTargetAmount: 10000, questTargetDate: null,
  questStatus: 'active', questRedeemedDate: null, ...over,
});

const tx = (over) => ({
  id: over.id, type: 'quest_contribution', amount: 100, date: '2026-08-01', createdAt: 0,
  categoryId: 'q1', incomeCategoryId: null, description: '', isRedemption: false, ...over,
});

describe('createQuest', () => {
  it('creates an active quest category row under savings with a persisted color continuing the shared index', () => {
    const categories = [{ id: 'c1' }];
    const incomeCategories = [{ id: 'ic1' }, { id: 'ic2' }];
    const q = createQuest('Goa Trip', 'flag', 10000, '2026-12-01', categories, incomeCategories);
    expect(q).toMatchObject({
      name: 'Goa Trip', icon: 'flag', type: 'quest', group: 'savings', archived: false,
      questTargetAmount: 10000, questTargetDate: '2026-12-01', questStatus: 'active', questRedeemedDate: null,
    });
    expect(q.id).toBeTruthy();
    expect(q.color).toBe('oklch(0.62 0.13 300)'); // index 3 (1 category + 2 income categories)
  });

  it('stamps createdAt (the sync pending-change indicator relies on this)', () => {
    const q = createQuest('Goa Trip', 'flag', 10000, '2026-12-01', [], [], 12345);
    expect(q.createdAt).toBe(12345);
  });
});

describe('questProgress', () => {
  it('computes contributed, progressFraction, isFullyFunded, and shortfall', () => {
    const transactions = [tx({ id: 't1', amount: 4000 }), tx({ id: 't2', amount: 2000 })];
    const p = questProgress(quest(), transactions);
    expect(p).toEqual({ contributed: 6000, progressFraction: 0.6, isFullyFunded: false, shortfall: 4000 });
  });

  it('caps progressFraction at 1 and reports fully funded once contributed meets or exceeds target', () => {
    const transactions = [tx({ id: 't1', amount: 15000 })];
    const p = questProgress(quest(), transactions);
    expect(p.progressFraction).toBe(1);
    expect(p.isFullyFunded).toBe(true);
    expect(p.shortfall).toBe(0);
  });

  it('is fully funded at exactly the target (>=, not >)', () => {
    const transactions = [tx({ id: 't1', amount: 10000 })];
    expect(questProgress(quest(), transactions).isFullyFunded).toBe(true);
  });

  it('has 0 progressFraction for a target of 0', () => {
    const p = questProgress(quest({ questTargetAmount: 0 }), []);
    expect(p.progressFraction).toBe(0);
  });
});

describe('recomputeQuestStatus', () => {
  it('is completed once contributions reach the target', () => {
    const transactions = [tx({ id: 't1', amount: 10000 })];
    expect(recomputeQuestStatus(quest(), transactions)).toBe('completed');
  });

  it('is active below the target', () => {
    const transactions = [tx({ id: 't1', amount: 9999 })];
    expect(recomputeQuestStatus(quest(), transactions)).toBe('active');
  });

  it('reverts a completed-looking quest back to active if contributions drop below target (edit/delete)', () => {
    expect(recomputeQuestStatus(quest({ questStatus: 'completed' }), [])).toBe('active');
  });

  it('never touches a redeemed quest, even if contributions no longer cover the target', () => {
    expect(recomputeQuestStatus(quest({ questStatus: 'redeemed' }), [])).toBe('redeemed');
  });

  it('stays active for a zero/undefined target regardless of contributions', () => {
    const transactions = [tx({ id: 't1', amount: 500 })];
    expect(recomputeQuestStatus(quest({ questTargetAmount: 0 }), transactions)).toBe('active');
  });
});

describe('questRows', () => {
  const budgetCategory = { id: 'c1', type: 'budget', name: 'Groceries' };
  const active = quest({ id: 'q1', name: 'Zoo Trip', questStatus: 'active' });
  const completed = quest({ id: 'q2', name: 'Amp Fund', questStatus: 'completed' });
  const redeemed = quest({ id: 'q3', name: 'Bike', questStatus: 'redeemed' });

  it('excludes non-quest categories and sorts alphabetically by name', () => {
    const rows = questRows([budgetCategory, active, completed, redeemed], []);
    expect(rows.map((r) => r.quest.name)).toEqual(['Amp Fund', 'Bike', 'Zoo Trip']);
  });

  it('narrows to the given statuses when provided', () => {
    const rows = questRows([active, completed, redeemed], [], ['active', 'completed']);
    expect(rows.map((r) => r.quest.id)).toEqual(['q2', 'q1']);
  });

  it('includes progress fields per row', () => {
    const transactions = [tx({ id: 't1', categoryId: 'q1', amount: 2500 })];
    const [row] = questRows([active], transactions);
    expect(row.contributed).toBe(2500);
  });
});

describe('withRecomputedQuestStatus', () => {
  it('updates only the matching quest, recomputing its status from the given transactions', () => {
    const q1 = quest({ id: 'q1', questStatus: 'active' });
    const q2 = quest({ id: 'q2', questStatus: 'active' });
    const transactions = [tx({ id: 't1', categoryId: 'q1', amount: 10000 })];
    const updated = withRecomputedQuestStatus([q1, q2], 'q1', transactions);
    expect(updated.find((c) => c.id === 'q1').questStatus).toBe('completed');
    expect(updated.find((c) => c.id === 'q2')).toBe(q2); // untouched, same reference
  });

  it('returns the same category reference when the status does not change', () => {
    const q1 = quest({ id: 'q1', questStatus: 'active' });
    const updated = withRecomputedQuestStatus([q1], 'q1', []);
    expect(updated[0]).toBe(q1);
  });

  it('leaves non-category-matching entries (e.g. budget categories) untouched', () => {
    const budgetCategory = { id: 'c1', type: 'budget', name: 'Groceries' };
    const updated = withRecomputedQuestStatus([budgetCategory], 'q1', []);
    expect(updated[0]).toBe(budgetCategory);
  });
});

describe('redeemQuest', () => {
  it('logs a redemption expense for the cumulative contribution and marks the quest redeemed', () => {
    const transactions = [tx({ id: 't1', amount: 4000 }), tx({ id: 't2', amount: 2000 })];
    const now = new Date('2026-08-15T10:00:00');
    const { transaction, questPatch } = redeemQuest(quest(), transactions, now);
    expect(transaction).toMatchObject({
      type: 'expense', amount: 6000, date: '2026-08-15', categoryId: 'q1',
      description: 'Goa Trip — Redeemed', isRedemption: true, incomeCategoryId: null,
    });
    expect(transaction.id).toBeTruthy();
    expect(transaction.createdAt).toBe(now.getTime());
    expect(questPatch).toEqual({ questStatus: 'redeemed', questRedeemedDate: '2026-08-15' });
  });

  it('allows early redemption of an active quest below target', () => {
    const transactions = [tx({ id: 't1', amount: 100 })];
    const { transaction } = redeemQuest(quest(), transactions, new Date('2026-08-15'));
    expect(transaction.amount).toBe(100);
  });

  it('allows redeeming a completed quest', () => {
    const transactions = [tx({ id: 't1', amount: 10000 })];
    const { questPatch } = redeemQuest(quest({ questStatus: 'completed' }), transactions, new Date('2026-08-15'));
    expect(questPatch.questStatus).toBe('redeemed');
  });

  it('throws if the quest is already redeemed', () => {
    expect(() => redeemQuest(quest({ questStatus: 'redeemed' }), [], new Date())).toThrow();
  });
});
