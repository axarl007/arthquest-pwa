import { dLabel } from './format.js';
import { GOLD_COLOR, DELETED_REF_COLOR } from '../theme/tokens.js';

/** "2026-08-15" -> "2026-08" */
export function monthKeyOfDate(iso) {
  return iso.slice(0, 7);
}

export function transactionsInMonth(transactions, monthKey) {
  return transactions.filter((t) => monthKeyOfDate(t.date) === monthKey);
}

/**
 * Income/expense/quest-contribution totals for a month, each summed straight from the
 * transaction list — mirrors the Android app's model, where these are always derived at query
 * time and never stored as running totals on a Category (see TransactionRepository/
 * QuestRepository: no `spent`/`contributed` column exists anywhere in the schema).
 */
export function monthlyTotals(transactions, monthKey) {
  const inMonth = transactionsInMonth(transactions, monthKey);
  const sumOf = (type) => inMonth.filter((t) => t.type === type).reduce((sum, t) => sum + t.amount, 0);
  const income = sumOf('income');
  const expense = sumOf('expense');
  const questContribution = sumOf('quest_contribution');
  return { income, expense, questContribution, net: income - expense - questContribution };
}

/** Sum of EXPENSE transactions against `categoryId` within `monthKey` — a budget category's "spent". */
export function spentForCategory(transactions, categoryId, monthKey) {
  return transactionsInMonth(transactions, monthKey)
    .filter((t) => t.type === 'expense' && t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
}

/**
 * All-time (not month-scoped) sum of QUEST_CONTRIBUTION transactions for `questId` — mirrors
 * QuestRepository.cumulativeContribution(), which sums every contribution ever made, not just
 * this month's, since a quest's progress is a running total across its whole lifetime. Matches
 * against `categoryId`, not a separate `questId` field: a Quest is a category row (type:'quest')
 * same as a budget category, and Android's TransactionEntity has exactly one FK — `categoryId` —
 * covering both, no second column. Mirroring that here keeps "does anything reference this id"
 * a single-field check everywhere, instead of two fields that must be kept in sync.
 */
export function contributedForQuest(transactions, questId) {
  return transactions
    .filter((t) => t.type === 'quest_contribution' && t.categoryId === questId)
    .reduce((sum, t) => sum + t.amount, 0);
}

/** Sorts by date, tie-broken by `createdAt` (so same-day transactions keep the order they were logged in). */
export function sortTransactions(transactions, direction = 'desc') {
  const sorted = [...transactions].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
  return direction === 'desc' ? sorted.reverse() : sorted;
}

export function filterByType(transactions, type) {
  if (type === 'all') return transactions;
  return transactions.filter((t) => t.type === type);
}

/**
 * Buckets transactions into { label, items } groups by dLabel(), in the order each label was
 * first encountered. Assumes `transactions` is already date-sorted (as it always is here, via
 * sortTransactions) so same-label items end up contiguous; still matches by label across the
 * whole groups list rather than only the most-recent one, so an out-of-order input degrades to
 * "grouped correctly, display order slightly odd" rather than silently splitting one label into
 * two buckets.
 */
export function groupByDateLabel(transactions, todayIso) {
  const groups = [];
  for (const t of transactions) {
    const label = dLabel(t.date, todayIso);
    const existing = groups.find((g) => g.label === label);
    if (existing) {
      existing.items.push(t);
    } else {
      groups.push({ label, items: [t] });
    }
  }
  return groups;
}

/**
 * Resolves what a transaction is "about" — the category/income-source/quest it points at — for
 * display, matching each type's fallback-if-not-found copy from the design spec, including its
 * icon-box color. The color rule is the design spec's own (not a symmetrical one worth guessing
 * at twice): income and quest-contribution rows use a fixed semantic accent regardless of which
 * income source/quest they're against, a redemption row uses a fixed gold, and only a plain
 * expense row uses its own budget category's persisted color. `semanticColors` is the current
 * theme's { accent, quest, ... } (see theme/tokens.js semanticColors()) — the one piece of this
 * that's genuinely theme-dependent, so still supplied by the caller rather than baked in here.
 */
export function resolveTransactionSubject(tx, categories, incomeCategories, semanticColors) {
  if (tx.type === 'income') {
    const c = incomeCategories.find((ic) => ic.id === tx.incomeCategoryId);
    return { name: c ? c.name : 'Income', icon: c ? c.icon : 'account_balance_wallet', kind: 'income', color: semanticColors.accent };
  }
  if (tx.type === 'quest_contribution') {
    const q = categories.find((c) => c.id === tx.categoryId);
    return { name: q ? q.name : 'Quest', icon: q ? q.icon || 'flag' : 'flag', kind: 'quest', color: semanticColors.quest };
  }
  if (tx.isRedemption) {
    const q = categories.find((c) => c.id === tx.categoryId);
    return { name: `${q ? q.name : 'Quest'} redeemed`, icon: 'redeem', kind: 'redemption', color: GOLD_COLOR };
  }
  const c = categories.find((cat) => cat.id === tx.categoryId);
  return { name: c ? c.name : 'Other', icon: c ? c.icon : 'category', kind: 'expense', color: c ? c.color : DELETED_REF_COLOR };
}
