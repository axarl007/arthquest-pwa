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

/** `{ [key]: previous entry | null }` for every payee-memory key whose value `next` changed —
 * with the matching `next` entries, what undoImport needs to put the memory back. */
export function payeeEntriesChangedBy(prevMap, nextMap) {
  const changed = {};
  for (const key of Object.keys(nextMap)) {
    if (nextMap[key] !== prevMap[key]) changed[key] = prevMap[key] ?? null;
  }
  return changed;
}

/**
 * Undo of one import batch (ticket #38): tombstones (never hard-deletes — see deleteTransaction)
 * every transaction in `batch.transactionIds`, recomputes the quests they touched, and puts back
 * the payee-memory entries the import overwrote, so a wrong mapping that was just undone isn't
 * prefilled again next time. Only the batch's own keys are restored, not a whole-map snapshot, so
 * anything else written to the map meanwhile survives. Tombstoned rows no longer
 * count as already imported (prepareReview), so the same file can be imported again.
 */
export function undoImport(state, batch, now = Date.now()) {
  const ids = new Set(batch.transactionIds);
  const transactions = state.transactions.map((t) => (ids.has(t.id) && !t.deletedAt ? { ...t, deletedAt: now } : t));
  const questIds = new Set(state.transactions.filter((t) => ids.has(t.id) && t.type === 'quest_contribution').map((t) => t.categoryId));
  let categories = state.categories;
  for (const questId of questIds) categories = withRecomputedQuestStatus(categories, questId, transactions);
  // Restored as *new* writes stamped `now` — a key the import created becomes a cleared entry
  // rather than being deleted — so payee memory's last-write-wins sync merge (#39) carries the undo
  // to a peer that already received the import, instead of the peer's newer entry winning it back.
  // A key is only restored while it still holds exactly what this import wrote — if a sync (or a
  // later import) changed it since, that newer choice wins and undo leaves it alone.
  const payeeCategoryMap = { ...(state.payeeCategoryMap ?? {}) };
  const sameEntry = (a, b) => a?.type === b?.type && a?.categoryId === b?.categoryId && a?.updatedAt === b?.updatedAt;
  for (const [key, previous] of Object.entries(batch.previousPayeeEntries ?? {})) {
    if (!sameEntry(payeeCategoryMap[key], batch.learnedPayeeEntries?.[key])) continue;
    payeeCategoryMap[key] = previous
      ? { ...previous, updatedAt: now }
      : { type: null, categoryId: null, updatedAt: now };
  }
  return { transactions, categories, payeeCategoryMap };
}

/**
 * Whether `batch` can still be undone safely: every one of its transactions must still be live
 * (a reset or backup restore since the import replaces them — undoing then would write stale
 * payee memory into unrelated data), and no quest it contributed to may have been redeemed since
 * (the redemption's amount was the contribution total at that moment, which undo would make
 * exceed what's left).
 */
export function canUndoImport(state, batch) {
  const byId = new Map(state.transactions.map((t) => [t.id, t]));
  const batchTxs = batch.transactionIds.map((id) => byId.get(id));
  if (batchTxs.some((t) => !t || t.deletedAt)) return false;
  const questIds = new Set(batchTxs.filter((t) => t.type === 'quest_contribution').map((t) => t.categoryId));
  return !state.categories.some((c) => questIds.has(c.id) && c.questStatus === 'redeemed');
}
