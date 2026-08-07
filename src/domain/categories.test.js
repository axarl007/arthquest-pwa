import { describe, it, expect } from 'vitest';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, GROUP_LABELS, GROUPS_ORDER, seedDefaultsIfNeeded } from './categories.js';

describe('DEFAULT_EXPENSE_CATEGORIES', () => {
  it('has exactly the 17 categories from the Android app, in order, summing to 100%', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES).toHaveLength(17);
    const total = DEFAULT_EXPENSE_CATEGORIES.reduce((sum, c) => sum + c.percentage, 0);
    expect(total).toBe(100);
  });

  it('matches the Android DefaultCategories.kt seed exactly', () => {
    expect(DEFAULT_EXPENSE_CATEGORIES[0]).toEqual({ name: 'Housing', icon: 'home', group: 'needs', percentage: 25 });
    expect(DEFAULT_EXPENSE_CATEGORIES[6]).toEqual({
      name: 'Other Loan EMIs', icon: 'account_balance', group: 'needs', percentage: 1,
    });
    expect(DEFAULT_EXPENSE_CATEGORIES[12]).toEqual({
      name: 'Miscellaneous', icon: 'apps', group: 'wants', percentage: 4,
    });
    expect(DEFAULT_EXPENSE_CATEGORIES[16]).toEqual({
      name: 'Gifts & Festivals', icon: 'redeem', group: 'savings', percentage: 2,
    });
  });

  it('every category belongs to a known group', () => {
    for (const c of DEFAULT_EXPENSE_CATEGORIES) {
      expect(GROUPS_ORDER).toContain(c.group);
    }
  });
});

describe('DEFAULT_INCOME_CATEGORIES', () => {
  it('matches the Android app exactly', () => {
    expect(DEFAULT_INCOME_CATEGORIES).toEqual([
      { name: 'Salary', icon: 'work' },
      { name: 'Freelance', icon: 'laptop_mac' },
      { name: 'Other Income', icon: 'account_balance_wallet' },
    ]);
  });
});

describe('GROUP_LABELS', () => {
  it('has a display label for every group', () => {
    for (const g of GROUPS_ORDER) expect(GROUP_LABELS[g]).toBeTruthy();
  });
});

describe('seedDefaultsIfNeeded', () => {
  it('creates all default budget + income categories when none exist yet', () => {
    const patch = seedDefaultsIfNeeded({ categories: [], incomeCategories: [] });
    expect(patch.categories).toHaveLength(17);
    expect(patch.categories.every((c) => c.type === 'budget')).toBe(true);
    expect(patch.categories.every((c) => c.archived === false)).toBe(true);
    expect(patch.incomeCategories).toHaveLength(3);
    // ids are unique
    const ids = patch.categories.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not duplicate budget categories if a BUDGET-type category already exists', () => {
    const existing = { categories: [{ id: 'x', name: 'Custom', icon: 'category', type: 'budget', group: 'needs', archived: false }], incomeCategories: [] };
    const patch = seedDefaultsIfNeeded(existing);
    expect(patch.categories).toBeUndefined();
  });

  it('does not duplicate income categories if any already exist', () => {
    const existing = { categories: [], incomeCategories: [{ id: 'y', name: 'Custom income', icon: 'work' }] };
    const patch = seedDefaultsIfNeeded(existing);
    expect(patch.incomeCategories).toBeUndefined();
  });

  it('seeds budget categories even if only quest-type categories exist (mirrors the BUDGET-type-only guard)', () => {
    const existing = { categories: [{ id: 'q1', name: 'Trip', icon: 'flag', type: 'quest', group: 'savings', archived: false }], incomeCategories: [] };
    const patch = seedDefaultsIfNeeded(existing);
    expect(patch.categories).toHaveLength(18); // 1 existing quest + 17 new budget
  });
});
