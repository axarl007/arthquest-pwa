import { catColor } from '../theme/tokens.js';

/**
 * The 17 default categories and their percentages, ported verbatim from the Android app's
 * DefaultCategories.kt (sourced there from the 50-30-20 rule, Dave Ramsey's category-percentage
 * guidance, and India-specific salary-split research — not arbitrary placeholders).
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Housing', icon: 'home', group: 'needs', percentage: 25 },
  { name: 'Groceries', icon: 'shopping_cart', group: 'needs', percentage: 8 },
  { name: 'Utilities', icon: 'bolt', group: 'needs', percentage: 5 },
  { name: 'Transport', icon: 'directions_car', group: 'needs', percentage: 5 },
  { name: 'Insurance', icon: 'shield', group: 'needs', percentage: 4 },
  { name: 'Healthcare', icon: 'health_and_safety', group: 'needs', percentage: 2 },
  { name: 'Other Loan EMIs', icon: 'account_balance', group: 'needs', percentage: 1 },
  { name: 'Shopping', icon: 'shopping_bag', group: 'wants', percentage: 8 },
  { name: 'Travel & Vacation', icon: 'flight', group: 'wants', percentage: 6 },
  { name: 'Dining Out', icon: 'restaurant', group: 'wants', percentage: 5 },
  { name: 'Entertainment & Subscriptions', icon: 'movie', group: 'wants', percentage: 4 },
  { name: 'Hobbies & Personal Care', icon: 'spa', group: 'wants', percentage: 3 },
  { name: 'Miscellaneous', icon: 'apps', group: 'wants', percentage: 4 },
  { name: 'Investments', icon: 'trending_up', group: 'savings', percentage: 8 },
  { name: 'Emergency Fund', icon: 'umbrella', group: 'savings', percentage: 5 },
  { name: 'Retirement', icon: 'savings', group: 'savings', percentage: 5 },
  { name: 'Gifts & Festivals', icon: 'redeem', group: 'savings', percentage: 2 },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', icon: 'work' },
  { name: 'Freelance', icon: 'laptop_mac' },
  { name: 'Other Income', icon: 'account_balance_wallet' },
];

export const GROUPS_ORDER = ['needs', 'wants', 'savings'];
export const GROUP_LABELS = { needs: 'Needs', wants: 'Wants', savings: 'Savings' };

export function makeId() {
  return crypto.randomUUID();
}

/**
 * Flips a budget category's `archived` flag and stamps `archivedAt` with when it last changed —
 * categories are never removed from the array (only archived/unarchived), so this timestamp is
 * the field a future multi-device merge needs to resolve two devices toggling the same category
 * differently while offline, the same role `deletedAt` plays for transactions.
 */
export function toggleArchived(categories, categoryId, now = Date.now()) {
  return categories.map((c) => (c.id === categoryId ? { ...c, archived: !c.archived, archivedAt: now } : c));
}

/**
 * Mirrors OnboardingViewModel.seedDefaultsIfNeeded(): creates the default budget categories only
 * if no BUDGET-type category exists yet (quest-only state still gets seeded), and the default
 * income categories only if none exist at all. Idempotent — a no-op key is simply absent from the
 * returned patch, so `setState(patch)` merges cleanly whichever combination fired.
 *
 * `color` has no Android counterpart (CategoryEntity has no color column — it's a design-spec-only
 * concept for tinting a category's icon box in "flat" icon style) so it's assigned here, once, at
 * creation time via `catColor(index)` — continuing the index across budget then income categories,
 * matching the design spec's own buildCategories()/buildIncomeCats() — and persisted on the
 * category/income-category object rather than recomputed from display position, since sort order
 * (e.g. onboarding's alphabetical rows) must not change which color a category has.
 */
export function seedDefaultsIfNeeded(state) {
  const patch = {};
  const hasBudgetCategory = state.categories.some((c) => c.type === 'budget');
  let nextColorIndex = state.categories.length + state.incomeCategories.length;
  if (!hasBudgetCategory) {
    const seeded = DEFAULT_EXPENSE_CATEGORIES.map((seed) => ({
      id: makeId(),
      name: seed.name,
      icon: seed.icon,
      type: 'budget',
      group: seed.group,
      archived: false,
      archivedAt: null,
      color: catColor(nextColorIndex++),
    }));
    patch.categories = [...state.categories, ...seeded];
  }
  if (state.incomeCategories.length === 0) {
    patch.incomeCategories = DEFAULT_INCOME_CATEGORIES.map((seed) => ({
      id: makeId(),
      name: seed.name,
      icon: seed.icon,
      color: catColor(nextColorIndex++),
    }));
  }
  return patch;
}
