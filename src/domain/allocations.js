import { DEFAULT_EXPENSE_CATEGORIES, makeId } from './categories.js';
import { halfUpRound } from './money.js';
import { addMonthsToKey } from './format.js';

const DEFAULT_PERCENTAGE_BY_NAME = new Map(DEFAULT_EXPENSE_CATEGORIES.map((c) => [c.name, c.percentage]));

/**
 * Mirrors OnboardingViewModel.loadRows(): active (non-archived) BUDGET-type categories, each
 * pre-filled with its existing allocation percentage for `monthKey` if one exists, else the
 * default-by-name percentage, else 0 — sorted alphabetically by name (not group/declaration
 * order; the real ViewModel does `.sortedBy { it.name }`, grouping into Needs/Wants/Savings
 * sections happens purely at render time on top of this flat, alpha-sorted list).
 */
export function buildOnboardingRows(categories, budgetAllocations, monthKey) {
  const allocationByCategoryId = new Map(
    budgetAllocations.filter((a) => a.month === monthKey).map((a) => [a.categoryId, a]),
  );
  return categories
    .filter((c) => c.type === 'budget' && !c.archived)
    .map((c) => ({
      categoryId: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
      group: c.group,
      percentage: allocationByCategoryId.get(c.id)?.percentage ?? DEFAULT_PERCENTAGE_BY_NAME.get(c.name) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function allocationTotals(rows) {
  const allocatedPercentage = rows.reduce((sum, r) => sum + r.percentage, 0);
  return {
    allocatedPercentage,
    remainingPercentage: 100 - allocatedPercentage,
    isOverAllocated: allocatedPercentage > 100,
  };
}

/**
 * Mirrors BudgetAllocationRepository.saveAllocations(): computes each row's rupee amount from
 * `income * percentage / 100` (half-up rounded to paise), tagged with `monthKey`. Throws if the
 * percentages sum to more than 100 — the cap is enforced here (save time), not just as a UI
 * affordance, matching the Android repository's own `require()` guard. Returns only the new rows
 * for `monthKey`; the caller is responsible for replacing any prior rows for that month in the
 * full allocations list (delete-then-insert, like the Android transaction).
 */
export function saveAllocations(income, rows, monthKey) {
  const total = rows.reduce((sum, r) => sum + r.percentage, 0);
  if (total > 100) {
    throw new Error(`Allocations for ${monthKey} sum to ${total}% which exceeds 100%`);
  }
  return rows.map((r) => ({
    id: makeId(),
    categoryId: r.categoryId,
    month: monthKey,
    percentage: r.percentage,
    amount: halfUpRound((r.percentage / 100) * income, 2),
  }));
}

/**
 * Mirrors BudgetAllocationRepository.ensureMonthSeeded(): if `monthKey` has no allocation rows
 * yet but the immediately preceding month does, copies that month's rows forward verbatim (new
 * ids, same percentages/amounts) so a newly-opened month always has a budget rather than blank
 * categories. No-ops if `monthKey` already has rows, or the previous month has none either.
 */
export function ensureMonthSeeded(budgetAllocations, monthKey) {
  if (budgetAllocations.some((a) => a.month === monthKey)) return budgetAllocations;
  const prevKey = addMonthsToKey(monthKey, -1);
  const previous = budgetAllocations.filter((a) => a.month === prevKey);
  if (previous.length === 0) return budgetAllocations;
  const seeded = previous.map((a) => ({ ...a, id: makeId(), month: monthKey }));
  return [...budgetAllocations, ...seeded];
}
