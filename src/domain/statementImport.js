/**
 * Statement import (ticket #36): turning parsed NormalizedRows (see importers/index.js) into
 * reviewable groups, then into transactions. No Android counterpart — this feature is PWA/Capacitor
 * only, so the GitHub issue is the spec.
 */
import { notDeleted } from './transactions.js';
import { withRecomputedQuestStatus } from './quests.js';
import { categoryOptionsForType } from './categoryOptions.js';

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'dr', 'shri', 'smt']);

/** Grouping/memory key for a payee: lowercased, punctuation dropped, leading honorifics removed. */
export function normalizePayee(payee) {
  const words = payee.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  while (words.length > 1 && HONORIFICS.has(words[0])) words.shift();
  return words.join(' ');
}

export function defaultTypeForDirection(direction) {
  return direction === 'credit' ? 'income' : 'expense';
}

/**
 * Drops rows already present as a non-deleted transaction (by `externalId`) plus duplicate rows
 * within the file itself. Tombstoned matches don't count: an undone/deleted import can be
 * imported again.
 */
export function prepareReview(rows, transactions) {
  const existing = new Set(notDeleted(transactions).map((t) => t.externalId).filter(Boolean));
  const seen = new Set();
  const fresh = [];
  let alreadyImportedCount = 0;
  for (const r of rows) {
    if (existing.has(r.externalId)) {
      alreadyImportedCount++;
      continue;
    }
    if (seen.has(r.externalId)) continue;
    seen.add(r.externalId);
    fresh.push(r);
  }
  return { rows: fresh, alreadyImportedCount };
}

/**
 * Groups rows by (direction, normalized payee) in first-appearance order. Direction is part of the
 * key so a group is never a mix of money-in and money-out — paying a friend and being paid back by
 * them are different categories.
 */
export function groupRowsByPayee(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = `${r.direction}:${normalizePayee(r.payee)}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, payee: r.payee, direction: r.direction, rows: [], total: 0 };
      groups.set(key, group);
    }
    group.rows.push(r);
    group.total += r.amount;
  }
  return [...groups.values()];
}

/** `{ [externalId]: { type, categoryId, skip } }` — every row starts on its direction's type, uncategorized. */
export function initialAssignments(rows) {
  return Object.fromEntries(rows.map((r) => [r.externalId, { type: defaultTypeForDirection(r.direction), categoryId: null, skip: false }]));
}

function hasValidCategory(assignment, state) {
  return assignment.categoryId != null
    && categoryOptionsForType(assignment.type, state).some((o) => o.id === assignment.categoryId);
}

/** Included rows whose category is missing or no longer selectable for their type, in row order. */
export function unassignedRowIds(rows, assignments, state) {
  return rows
    .filter((r) => {
      const a = assignments[r.externalId];
      return !a.skip && !hasValidCategory(a, state);
    })
    .map((r) => r.externalId);
}

/**
 * Included rows → transactions. `createdAt` is a real import-time stamp (`now`), offset by +1 per
 * row in the statement's chronological order: deriving it from the statement's own time would put
 * it before the last sync, hiding the rows from sync's pending-change count, while the offset still
 * makes same-day rows sort in the order they actually happened. Statements list newest first, so
 * among identical date+time rows the later one in the file is the older one.
 */
export function buildImportTransactions(rows, assignments, { now, makeId }) {
  const included = rows
    .map((r, index) => ({ r, index }))
    .filter(({ r }) => !assignments[r.externalId].skip);
  for (const { r } of included) {
    if (assignments[r.externalId].categoryId == null) throw new Error(`Row ${r.externalId} has no category`);
  }
  included.sort((a, b) => {
    const ka = `${a.r.date} ${a.r.time}`;
    const kb = `${b.r.date} ${b.r.time}`;
    if (ka !== kb) return ka < kb ? -1 : 1;
    return b.index - a.index;
  });
  return included.map(({ r }, order) => {
    const { type, categoryId } = assignments[r.externalId];
    return {
      id: makeId(),
      type,
      amount: r.amount,
      date: r.date,
      createdAt: now + order,
      description: r.payee,
      categoryId: type === 'income' ? null : categoryId,
      incomeCategoryId: type === 'income' ? categoryId : null,
      isRedemption: false,
      deletedAt: null,
      externalId: r.externalId,
    };
  });
}

/** State patch adding `imported` and recomputing every quest a contribution touched. */
export function applyImportedTransactions(state, imported) {
  const transactions = [...imported, ...state.transactions];
  const questIds = new Set(imported.filter((t) => t.type === 'quest_contribution').map((t) => t.categoryId));
  let categories = state.categories;
  for (const questId of questIds) categories = withRecomputedQuestStatus(categories, questId, transactions);
  return { transactions, categories };
}
