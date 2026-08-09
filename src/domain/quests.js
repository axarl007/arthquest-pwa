import { contributedForQuest } from './transactions.js';
import { todayIso } from './format.js';
import { catColor } from '../theme/tokens.js';
import { makeId } from './categories.js';

/**
 * A new Quest category row — a Quest is a `state.categories` entry (type:'quest', group forced
 * to 'savings'), mirroring CategoryRepository.createQuest exactly: name/icon/targetAmount/
 * targetDate as given, questStatus starts 'active', questRedeemedDate null. `color` follows the
 * same persisted-at-creation convention as every other category (see domain/categories.js).
 */
export function createQuest(name, icon, targetAmount, targetDate, categories, incomeCategories) {
  return {
    id: makeId(),
    name,
    icon,
    type: 'quest',
    group: 'savings',
    archived: false,
    archivedAt: null,
    color: catColor(categories.length + incomeCategories.length),
    questTargetAmount: targetAmount,
    questTargetDate: targetDate,
    questStatus: 'active',
    questRedeemedDate: null,
  };
}

/** contributed/progressFraction/isFullyFunded/shortfall for a quest, derived from `transactions`
 * at render time — mirrors QuestsViewModel's QuestRow computed properties exactly. */
export function questProgress(quest, transactions) {
  const contributed = contributedForQuest(transactions, quest.id);
  const target = quest.questTargetAmount ?? 0;
  const progressFraction = target > 0 ? Math.min(Math.max(contributed / target, 0), 1) : 0;
  const isFullyFunded = contributed >= target;
  const shortfall = Math.max(target - contributed, 0);
  return { contributed, progressFraction, isFullyFunded, shortfall };
}

/**
 * Every Quest category paired with its progress, alphabetically by name — mirrors
 * QuestsViewModel's `quests.sortedBy { it.name }.map { QuestRow(...) }`. Optionally narrowed to a
 * set of statuses (e.g. Home's carousel wants only 'active'/'completed', never 'redeemed'); shared
 * between Home and the Quests screen so both derive identical rows/ordering from the same data.
 */
export function questRows(categories, transactions, statuses = null) {
  return categories
    .filter((c) => c.type === 'quest' && (!statuses || statuses.includes(c.questStatus)))
    .map((quest) => ({ quest, ...questProgress(quest, transactions) }))
    .sort((a, b) => a.quest.name.localeCompare(b.quest.name));
}

/**
 * Mirrors QuestRepository.recomputeStatus: COMPLETED once cumulative contributions reach the
 * target, back to ACTIVE if they no longer do (a contribution was edited down or deleted) —
 * never touches a REDEEMED quest, which is terminal. Call after every quest-contribution
 * transaction insert/edit/delete so status can never drift from the transactions that define it.
 * Returns the new questStatus string (caller applies it via setState).
 */
export function recomputeQuestStatus(quest, transactions) {
  if (quest.questStatus === 'redeemed') return quest.questStatus;
  const target = quest.questTargetAmount ?? 0;
  const contributed = contributedForQuest(transactions, quest.id);
  const hasReachedTarget = target > 0 && contributed >= target;
  return hasReachedTarget ? 'completed' : 'active';
}

/**
 * Applies `recomputeQuestStatus` to `questId` within `categories` against `transactions` (already
 * reflecting whatever quest-contribution transaction was just inserted/deleted), leaving every
 * other category untouched. The one piece of glue LogTransactionSheet and TxActionsSheet both need
 * after mutating a quest-contribution transaction, so it lives here once instead of twice in UI code.
 */
export function withRecomputedQuestStatus(categories, questId, transactions) {
  return categories.map((c) => {
    if (c.id !== questId) return c;
    const questStatus = recomputeQuestStatus(c, transactions);
    return questStatus === c.questStatus ? c : { ...c, questStatus };
  });
}

/**
 * Mirrors QuestRepository.redeem: logs one EXPENSE transaction (amount = cumulative contribution
 * to date, same category as the Quest, isRedemption=true) and sets the Quest to REDEEMED, as a
 * single atomic write. Works whether the Quest is ACTIVE (early redemption) or COMPLETED. Throws
 * if already redeemed, matching the repository's own `require()` guard. Returns the new
 * transaction plus the patch to apply to the quest — caller (owning React state) applies both.
 */
export function redeemQuest(quest, transactions, now = new Date()) {
  if (quest.questStatus === 'redeemed') {
    throw new Error(`Quest ${quest.id} is already redeemed`);
  }
  const amount = contributedForQuest(transactions, quest.id);
  const date = todayIso(now);
  const transaction = {
    id: makeId(),
    type: 'expense',
    amount,
    date,
    createdAt: now.getTime(),
    description: `${quest.name} — Redeemed`,
    categoryId: quest.id,
    incomeCategoryId: null,
    isRedemption: true,
    deletedAt: null,
  };
  return { transaction, questPatch: { questStatus: 'redeemed', questRedeemedDate: date } };
}
