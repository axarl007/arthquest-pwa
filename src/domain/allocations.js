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
  // half-up rounded to 2dp: with fractional per-row percentages now allowed, summing many
  // JS floats (e.g. several 4.5s) can drift by a fraction of a cent (0.1 + 0.2 !== 0.3) —
  // rounding here keeps the 100%-allocated boundary check and the displayed total exact
  // rather than occasionally showing "100.00000000000001%" or a false over-allocation.
  const allocatedPercentage = halfUpRound(rows.reduce((sum, r) => sum + r.percentage, 0), 2);
  return {
    allocatedPercentage,
    remainingPercentage: halfUpRound(100 - allocatedPercentage, 2),
    isOverAllocated: allocatedPercentage > 100,
  };
}

/**
 * Strips a percentage input string down to digits and at most one decimal point with at most 2
 * fractional digits (matching the 2dp precision the rest of this module already standardizes on
 * — see allocationTotals/saveAllocations' halfUpRound calls), without parsing it to a number —
 * preserves whatever the user is mid-typing (e.g. a trailing ".") so a fractional split like
 * "4.5" can actually be typed digit-by-digit rather than snapping back to "4" the moment the "."
 * is entered. Capping fractional digits here (rather than only on commit) keeps the input's
 * on-screen width bounded while still focused, not just once parsePercentageInput rounds it.
 */
export function sanitizePercentageInput(raw) {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  const fractional = cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);
  return cleaned.slice(0, firstDot + 1) + fractional;
}

/** Parses a (already-sanitized) percentage input into a non-negative number half-up rounded to
 * 2dp, defaulting to 0 for empty/invalid input — the value actually committed to the row once
 * editing ends. Rounding here (not just relying on sanitizePercentageInput's typing-time cap)
 * keeps a directly-called/programmatic value just as bounded as one typed through the UI. */
export function parsePercentageInput(text) {
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? halfUpRound(n, 2) : 0;
}

/**
 * Mirrors BudgetAllocationRepository.saveAllocations(): computes each row's rupee amount from
 * `income * percentage / 100` (half-up rounded to paise), tagged with `monthKey`. Throws if the
 * percentages sum to more than 100 — the cap is enforced here (save time), not just as a UI
 * affordance, matching the Android repository's own `require()` guard. Returns only the new rows
 * for `monthKey`; the caller is responsible for replacing any prior rows for that month in the
 * full allocations list (delete-then-insert, like the Android transaction).
 *
 * `updatedAt` has no Android schema counterpart — like transactions' `deletedAt` and categories'
 * `archivedAt`, it exists solely so a multi-device merge (`domain/sync.js`, ticket #19) can pick
 * the most-recently-edited row when two devices independently replace the same (categoryId,
 * month) row with different ids while offline.
 */
export function saveAllocations(income, rows, monthKey, now = Date.now()) {
  const total = halfUpRound(rows.reduce((sum, r) => sum + r.percentage, 0), 2);
  if (total > 100) {
    throw new Error(`Allocations for ${monthKey} sum to ${total}% which exceeds 100%`);
  }
  return rows.map((r) => ({
    id: makeId(),
    categoryId: r.categoryId,
    month: monthKey,
    percentage: r.percentage,
    amount: halfUpRound((r.percentage / 100) * income, 2),
    updatedAt: now,
  }));
}

/**
 * Mirrors BudgetAllocationRepository.ensureMonthSeeded(): if `monthKey` has no allocation rows
 * yet but the immediately preceding month does, copies that month's rows forward verbatim (new
 * ids, same percentages/amounts) so a newly-opened month always has a budget rather than blank
 * categories. No-ops if `monthKey` already has rows, or the previous month has none either.
 *
 * Carries the source row's own `updatedAt` forward onto each copy (falling back to `now` only
 * for pre-sync data that never had one) rather than stamping a fresh one: this is a mechanical
 * copy triggered just by opening a new month (see Budget.jsx's mount effect), not a real edit, so
 * it must not out-rank an actual `saveAllocations` edit a peer made to that same month — a sync
 * merge (`domain/sync.js`) has no way to tell "copied verbatim" apart from "deliberately changed"
 * if both stamp `now`.
 */
export function ensureMonthSeeded(budgetAllocations, monthKey, now = Date.now()) {
  if (budgetAllocations.some((a) => a.month === monthKey)) return budgetAllocations;
  const prevKey = addMonthsToKey(monthKey, -1);
  const previous = budgetAllocations.filter((a) => a.month === prevKey);
  if (previous.length === 0) return budgetAllocations;
  const seeded = previous.map((a) => ({ ...a, id: makeId(), month: monthKey, updatedAt: a.updatedAt ?? now }));
  return [...budgetAllocations, ...seeded];
}
