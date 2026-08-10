import { describe, it, expect } from 'vitest';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, GROUP_LABELS, GROUPS_ORDER, seedDefaultsIfNeeded, toggleArchived } from './categories.js';
import { catColor } from '../theme/tokens.js';

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
    expect(patch.categories.every((c) => c.archivedAt === null)).toBe(true);
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

  it('assigns each seeded category a persisted, distinct color (no Android schema equivalent — a design-spec-only field), continuing the index across budget then income categories', () => {
    const patch = seedDefaultsIfNeeded({ categories: [], incomeCategories: [] });
    expect(patch.categories[0].color).toBe(catColor(0));
    expect(patch.categories[16].color).toBe(catColor(16));
    expect(patch.incomeCategories[0].color).toBe(catColor(17));
    expect(patch.incomeCategories[2].color).toBe(catColor(19));
    // colors are assigned once at creation and stored — not recomputed from array position later
    expect(patch.categories.every((c) => typeof c.color === 'string' && c.color.startsWith('oklch('))).toBe(true);
  });

  it('stamps every seeded category and income category with createdAt (the sync pending-change indicator relies on this)', () => {
    const patch = seedDefaultsIfNeeded({ categories: [], incomeCategories: [] }, 12345);
    expect(patch.categories.every((c) => c.createdAt === 12345)).toBe(true);
    expect(patch.incomeCategories.every((c) => c.createdAt === 12345)).toBe(true);
  });

  it('continues the color index from existing categories, so re-seeding onto a non-empty state never repeats a color already in use', () => {
    const existing = {
      categories: Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `Cat${i}`, icon: 'category', type: 'budget', group: 'needs', archived: false, color: catColor(i) })),
      incomeCategories: [],
    };
    // Force the seed by making it look like no BUDGET category exists yet is impossible here since
    // one does — instead verify the income-category branch (which does still run) picks up after 5.
    const patch = seedDefaultsIfNeeded(existing);
    expect(patch.incomeCategories[0].color).toBe(catColor(5));
  });
});

describe('toggleArchived', () => {
  it('flips archived and stamps archivedAt with the given timestamp, leaving other categories untouched', () => {
    const categories = [{ id: 'c1', archived: false, archivedAt: null }, { id: 'c2', archived: false, archivedAt: null }];
    const result = toggleArchived(categories, 'c1', 12345);
    expect(result.find((c) => c.id === 'c1')).toEqual({ id: 'c1', archived: true, archivedAt: 12345 });
    expect(result.find((c) => c.id === 'c2')).toEqual({ id: 'c2', archived: false, archivedAt: null });
  });

  it('toggling twice unarchives again and updates the timestamp', () => {
    const categories = [{ id: 'c1', archived: false, archivedAt: null }];
    const once = toggleArchived(categories, 'c1', 100);
    const twice = toggleArchived(once, 'c1', 200);
    expect(twice[0]).toEqual({ id: 'c1', archived: false, archivedAt: 200 });
  });

  it('defaults the timestamp to now when not given one', () => {
    const before = Date.now();
    const result = toggleArchived([{ id: 'c1', archived: false, archivedAt: null }], 'c1');
    expect(result[0].archivedAt).toBeGreaterThanOrEqual(before);
  });
});
