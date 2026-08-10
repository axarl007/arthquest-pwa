import { describe, it, expect } from 'vitest';
import { buildBackupJson, parseBackupJson, buildTransactionsCsv } from './exportData.js';

const state = {
  onboarded: true,
  theme: 'dark',
  iconStyle: 'cartoon',
  categories: [
    { id: 'c1', name: 'Groceries', icon: 'shopping_cart', type: 'budget', group: 'needs', archived: false, archivedAt: null, color: 'oklch(0.62 0.13 150)', createdAt: null, questTargetAmount: null, questTargetDate: null, questStatus: null, questRedeemedDate: null },
    { id: 'q1', name: 'Goa Trip', icon: 'flag', type: 'quest', group: 'savings', archived: false, archivedAt: null, color: 'oklch(0.62 0.13 300)', createdAt: null, questTargetAmount: 10000, questTargetDate: '2026-12-01', questStatus: 'active', questRedeemedDate: null },
  ],
  incomeCategories: [{ id: 'ic1', name: 'Salary', icon: 'work', color: 'oklch(0.62 0.13 28)', createdAt: null }],
  transactions: [
    { id: 't1', type: 'expense', amount: 500, date: '2026-08-05', createdAt: 1000, categoryId: 'c1', incomeCategoryId: null, description: 'Milk, eggs', isRedemption: false },
    { id: 't2', type: 'quest_contribution', amount: 2000, date: '2026-08-06', createdAt: 2000, categoryId: 'q1', incomeCategoryId: null, description: '', isRedemption: false },
  ],
  budgetAllocations: [{ id: 'a1', categoryId: 'c1', month: '2026-08', percentage: 8, amount: 9600 }],
  settingsToggles: { daily: true, monthEnd: true, backup: true, review: true },
  lastBackupReminderDate: '2026-07-25',
};

describe('buildBackupJson / parseBackupJson round-trip', () => {
  it('produces the Android-schema field shape (uppercase enums) for categories and transactions', () => {
    const parsed = JSON.parse(buildBackupJson(state));
    expect(parsed.categories[0]).toMatchObject({ type: 'BUDGET', group: 'NEEDS' });
    expect(parsed.categories[1]).toMatchObject({ type: 'QUEST', group: 'SAVINGS', questStatus: 'ACTIVE' });
    expect(parsed.transactions[0].type).toBe('EXPENSE');
    expect(parsed.transactions[1].type).toBe('QUEST_CONTRIBUTION');
  });

  it('round-trips categories, incomeCategories, transactions, and budgetAllocations exactly', () => {
    const json = buildBackupJson(state);
    const patch = parseBackupJson(json);
    expect(patch.categories).toEqual(state.categories);
    expect(patch.incomeCategories).toEqual(state.incomeCategories);
    expect(patch.transactions).toEqual(state.transactions);
    expect(patch.budgetAllocations).toEqual(state.budgetAllocations);
  });

  it('round-trips settings (theme, iconStyle, onboarded, toggles, lastBackupReminderDate)', () => {
    const patch = parseBackupJson(buildBackupJson(state));
    expect(patch.theme).toBe('dark');
    expect(patch.iconStyle).toBe('cartoon');
    expect(patch.onboarded).toBe(true);
    expect(patch.settingsToggles).toEqual(state.settingsToggles);
    expect(patch.lastBackupReminderDate).toBe('2026-07-25');
  });

  it('tolerates an import with no settings key (e.g. a data-only backup)', () => {
    const withoutSettings = JSON.parse(buildBackupJson(state));
    delete withoutSettings.settings;
    const patch = parseBackupJson(JSON.stringify(withoutSettings));
    expect(patch.categories).toEqual(state.categories);
    expect(patch.theme).toBeUndefined();
  });

  it('assigns a color to categories/income-categories missing one (e.g. a genuine Android export)', () => {
    const noColor = JSON.parse(buildBackupJson(state));
    for (const c of [...noColor.categories, ...noColor.incomeCategories]) delete c.color;
    const patch = parseBackupJson(JSON.stringify(noColor));
    expect(patch.categories.every((c) => !!c.color)).toBe(true);
    expect(patch.incomeCategories.every((c) => !!c.color)).toBe(true);
    // Deterministic and distinct, continuing the same index convention as seedDefaultsIfNeeded.
    expect(new Set([...patch.categories, ...patch.incomeCategories].map((c) => c.color)).size).toBe(3);
  });

  it('throws on an unrecognizable file', () => {
    expect(() => parseBackupJson('{"not":"a backup"}')).toThrow();
    expect(() => parseBackupJson('not even json')).toThrow();
  });

  it('round-trips a category\'s archivedAt timestamp (needed for a future multi-device merge to resolve conflicting archive toggles)', () => {
    const archived = { ...state, categories: [{ ...state.categories[0], archived: true, archivedAt: 555 }, state.categories[1]] };
    const patch = parseBackupJson(buildBackupJson(archived));
    expect(patch.categories[0].archivedAt).toBe(555);
  });

  it('defaults archivedAt to null for a backup that predates the field (e.g. a genuine Android export)', () => {
    const noArchivedAt = JSON.parse(buildBackupJson(state));
    for (const c of noArchivedAt.categories) delete c.archivedAt;
    const patch = parseBackupJson(JSON.stringify(noArchivedAt));
    expect(patch.categories.every((c) => c.archivedAt === null)).toBe(true);
  });

  it('excludes tombstoned (deletedAt set) transactions from the backup', () => {
    const withDeleted = {
      ...state,
      transactions: [...state.transactions, { id: 't3', type: 'expense', amount: 10, date: '2026-08-07', createdAt: 3000, categoryId: 'c1', incomeCategoryId: null, description: '', isRedemption: false, deletedAt: 4000 }],
    };
    const parsed = JSON.parse(buildBackupJson(withDeleted));
    expect(parsed.transactions.map((t) => t.id)).toEqual(['t1', 't2']);
  });
});

describe('buildTransactionsCsv', () => {
  it('has the exact DataExportFormatter header and one row per transaction', () => {
    const csv = buildTransactionsCsv(state);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Date,Type,Category,Description,Amount');
    expect(lines).toHaveLength(3);
  });

  it('resolves category names by type (expense/quest via categoryId, income via incomeCategoryId)', () => {
    const csv = buildTransactionsCsv(state);
    expect(csv).toContain('2026-08-05,EXPENSE,Groceries,"Milk, eggs",500');
    expect(csv).toContain('2026-08-06,QUEST_CONTRIBUTION,Goa Trip,,2000');
  });

  it('quotes fields containing commas and escapes embedded quotes', () => {
    const withQuote = {
      ...state,
      transactions: [{ id: 't3', type: 'expense', amount: 10, date: '2026-08-01', createdAt: 0, categoryId: 'c1', incomeCategoryId: null, description: 'He said "hi"', isRedemption: false }],
    };
    const csv = buildTransactionsCsv(withQuote);
    expect(csv).toContain('"He said ""hi"""');
  });

  it('falls back to an empty category name when the referenced category no longer exists', () => {
    const orphan = { ...state, categories: [], incomeCategories: [] };
    const csv = buildTransactionsCsv(orphan);
    expect(csv.split('\n')[1].startsWith('2026-08-05,EXPENSE,,')).toBe(true);
  });

  it('excludes tombstoned (deletedAt set) transactions', () => {
    const withDeleted = {
      ...state,
      transactions: [...state.transactions, { id: 't3', type: 'expense', amount: 10, date: '2026-08-07', createdAt: 3000, categoryId: 'c1', incomeCategoryId: null, description: '', isRedemption: false, deletedAt: 4000 }],
    };
    const csv = buildTransactionsCsv(withDeleted);
    expect(csv.split('\n')).toHaveLength(3); // header + t1 + t2, t3 excluded
  });
});
