import { spentForCategory } from './transactions.js';

/**
 * Status thresholds ported verbatim from BudgetViewModel.kt's BudgetCategoryRow — NOT the design
 * mockup's guessed 70%/100% split. Red is strictly over-allocation (spent > allocated, not >=),
 * yellow starts at 80% used, underused is under 50% used (with something actually spent).
 */
export const YELLOW_THRESHOLD_PERCENT = 80;
export const UNDERUSED_THRESHOLD_PERCENT = 50;

/**
 * One row per active (non-archived) BUDGET category for `monthKey`, joining that month's
 * allocation with actual spend. Mirrors BudgetViewModel.buildBudgetCategoryRows exactly so this
 * is safe to reuse for Home's "close to your limit" list too, matching the Android app's own
 * reuse of the same builder between BudgetViewModel and HomeViewModel.
 */
export function buildBudgetRows(categories, budgetAllocations, transactions, monthKey) {
  const allocationByCategoryId = new Map(
    budgetAllocations.filter((a) => a.month === monthKey).map((a) => [a.categoryId, a]),
  );
  return categories
    .filter((c) => c.type === 'budget' && !c.archived)
    .map((c) => {
      const allocated = allocationByCategoryId.get(c.id)?.amount ?? 0;
      const spent = spentForCategory(transactions, c.id, monthKey);
      return budgetRow(c, allocated, spent);
    });
}

function budgetRow(category, allocated, spent) {
  // Null (not 0) when nothing is allocated — the spend-to-allocation ratio is undefined, not zero.
  const percentUsed = allocated > 0 ? (spent / allocated) * 100 : null;
  const isOverBudget = spent > allocated;
  const isNotUsed = spent === 0;
  const isUnderused = !isNotUsed && !isOverBudget && (percentUsed ?? 0) < UNDERUSED_THRESHOLD_PERCENT;
  const colorState = isOverBudget ? 'red' : (percentUsed ?? 0) >= YELLOW_THRESHOLD_PERCENT ? 'yellow' : 'green';
  // Over-budget (including spend against zero allocation, where percentUsed is undefined) always
  // renders a full bar, never blank or overflowing.
  const progressFraction = isOverBudget ? 1 : Math.min(Math.max((percentUsed ?? 0) / 100, 0), 1);
  // Highest-priority-first sort key, ported verbatim from BudgetCategoryRow.sortKey: an
  // unallocated-but-spent row (percentUsed undefined, something spent) ranks above every
  // allocated row regardless of its percentUsed — nothing budgeted for it at all is the sharpest
  // signal — followed by allocated rows in descending percentUsed order, with unallocated-and-
  // unspent rows ranking lowest of all.
  const sortKey = percentUsed ?? (spent > 0 ? Infinity : 0);
  return {
    categoryId: category.id,
    name: category.name,
    icon: category.icon,
    color: category.color,
    group: category.group,
    allocated,
    spent,
    percentUsed,
    isOverBudget,
    isNotUsed,
    isUnderused,
    colorState,
    progressFraction,
    sortKey,
  };
}

export function matchesBudgetFilter(row, filter) {
  switch (filter) {
    case 'over':
      return row.isOverBudget;
    case 'under':
      return row.isUnderused;
    case 'unused':
      return row.isNotUsed;
    default:
      return true;
  }
}

/** Priority order (see budgetRow's sortKey) by default; reversed when `direction` is 'asc'. */
export function sortBudgetRows(rows, direction = 'desc') {
  const sorted = [...rows].sort((a, b) => a.sortKey - b.sortKey);
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/** month < currentMonth — matches BudgetUiState.isPastMonth, the source of the locked-month banner. */
export function isLockedMonth(monthKey, currentMonthKeyValue) {
  return monthKey < currentMonthKeyValue;
}

/** How many "near limit" categories Home's condensed list surfaces — ported from
 * HomeViewModel.kt's NEAR_LIMIT_LIMIT. */
export const NEAR_LIMIT_LIMIT = 3;

/**
 * Mirrors HomeViewModel's nearLimitCategories: the top `limit` categories not comfortably under
 * budget (yellow or red — "actually close" to their cap, not merely "has any spend"), reusing the
 * same builder and priority order the Budget screen itself uses so the two screens can never
 * disagree on which categories are flagged.
 */
export function nearLimitCategories(categories, budgetAllocations, transactions, monthKey, limit = NEAR_LIMIT_LIMIT) {
  const rows = buildBudgetRows(categories, budgetAllocations, transactions, monthKey).filter((r) => r.colorState !== 'green');
  return sortBudgetRows(rows, 'desc').slice(0, limit);
}
