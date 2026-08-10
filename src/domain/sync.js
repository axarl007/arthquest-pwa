/**
 * Multi-device merge logic (ticket #19) — pure and transport-free; #20 wires this over the
 * Nearby Connections plugin. Since the app has no in-place edit for transactions, categories, or
 * income categories (only add + tombstoned delete, per #16), merging is mostly an additive union
 * by id. The deliberate exceptions, each mirroring how that field is actually mutated elsewhere
 * in the app, are documented on their own helper below:
 *   - transactions: `deletedAt` — tombstone wins, never resurrected (deleteTransaction's own
 *     rationale, extended across devices).
 *   - categories: `archived`/`archivedAt` — last-write-wins by timestamp (toggleArchived).
 *   - quest categories: `questStatus`/`questRedeemedDate` — REDEEMED is terminal (sticky, like a
 *     tombstone); otherwise recomputed from the merged transactions, exactly as
 *     `recomputeQuestStatus` already does after every local transaction mutation.
 *   - budgetAllocations: deduped to one row per (categoryId, month) by `updatedAt` — editing a
 *     month hard-deletes its old rows and inserts new ones (saveAllocations' own doc comment), so
 *     two devices can independently replace the same month with different-id rows.
 *
 * `lastSyncedAt` is accepted for API-contract / future-diff-payload reasons (#20's "exchange a
 * diff since the last known sync point") but nothing below actually branches on it: every
 * conflict here already resolves from a per-record timestamp or from transaction-derived state,
 * which is a strictly stronger guarantee than gating on a shared "last synced" marker would give
 * — a tombstone set at any time, not just "after" some marker, must never be undone.
 */

import { recomputeQuestStatus } from './quests.js';
import { notDeleted } from './transactions.js';

function unionById(localItems, remoteItems, resolve) {
  const byId = new Map();
  for (const item of localItems) byId.set(item.id, item);
  for (const item of remoteItems) {
    const existing = byId.get(item.id);
    byId.set(item.id, existing ? resolve(existing, item) : item);
  }
  return [...byId.values()];
}

/** `null` beats nothing set; when both sides tombstoned the same id, the earlier timestamp wins
 * — deterministic and order-independent, though the visible outcome (deleted) is the same either
 * way since `notDeleted()` only checks truthiness, not the exact value. */
function pickDeletedAt(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

/**
 * A transaction is created exactly once and never edited afterward — the two copies of a given
 * id can only ever disagree on `deletedAt` (one side deleted it, the other hasn't synced that
 * yet). Tombstone wins unconditionally: resurrecting a deleted transaction because a peer's
 * older, pre-delete copy arrived is exactly the bug tombstones (#16) exist to prevent.
 */
function mergeTransaction(a, b) {
  return { ...a, deletedAt: pickDeletedAt(a.deletedAt, b.deletedAt) };
}

/**
 * Two devices can independently redeem the same quest while offline (`redeemQuest` has no way to
 * know a peer already did the same thing) — each logs its own EXPENSE transaction with
 * `isRedemption: true` against the quest's category id, and a plain id-union keeps both,
 * double-counting the withdrawal in `cumulativePosition`/spend totals. Only one redemption per
 * quest may survive a merge: the earliest by `date` (tie-broken by id) is kept, and every other
 * concurrent redemption for that quest is tombstoned. `deletedAt` is set to the loser's own
 * `createdAt` rather than the current wall-clock time — any truthy value works (`notDeleted()`
 * only checks truthiness), and reusing a field already on the record keeps this computation
 * pure/deterministic instead of depending on when the merge happens to run; `|| 1` guards the
 * rare case of a falsy `createdAt` (e.g. `0`/`undefined` on a hand-edited or legacy-imported
 * backup, see parseBackupJson), which would otherwise leave the loser looking not-deleted.
 * Winner selection is derived purely from the transactions' own content, so it's the same
 * regardless of merge order or how many times it runs (idempotent once only one survivor
 * remains).
 */
function dedupeConcurrentRedemptions(transactions) {
  const activeRedemptionsByQuest = new Map();
  for (const t of notDeleted(transactions)) {
    if (!t.isRedemption) continue;
    const list = activeRedemptionsByQuest.get(t.categoryId) ?? [];
    list.push(t);
    activeRedemptionsByQuest.set(t.categoryId, list);
  }
  const loserIds = new Set();
  for (const list of activeRedemptionsByQuest.values()) {
    if (list.length <= 1) continue;
    const sorted = [...list].sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.id < b.id ? -1 : 1));
    for (const loser of sorted.slice(1)) loserIds.add(loser.id);
  }
  if (loserIds.size === 0) return transactions;
  return transactions.map((t) => (loserIds.has(t.id) ? { ...t, deletedAt: t.createdAt || 1 } : t));
}

/** The one surviving (non-deleted) redemption transaction per quest id, post-dedup — computed
 * once for the whole category merge pass rather than re-scanning `mergedTransactions` per quest
 * category (`mergeCategories` calls this for every quest, and a `.find` per quest would be
 * O(quests * transactions) instead of O(transactions + quests)). */
function activeRedemptionsByQuestId(mergedTransactions) {
  const byQuestId = new Map();
  for (const t of notDeleted(mergedTransactions)) {
    if (t.isRedemption) byQuestId.set(t.categoryId, t);
  }
  return byQuestId;
}

function mergeTransactions(localTransactions, remoteTransactions) {
  return dedupeConcurrentRedemptions(unionById(localTransactions, remoteTransactions, mergeTransaction));
}

/** Last-write-wins by `archivedAt`; a never-toggled `null` is strictly older than any real
 * toggle (it means "created and untouched"), so it always loses to a side that has toggled at
 * all. On an exact timestamp tie, `archived: true` wins — an explicit, order-independent
 * tie-break, not accidental array position. */
function mergeArchived(a, b) {
  if (a.archivedAt == null && b.archivedAt == null) return { archived: a.archived, archivedAt: null };
  if (a.archivedAt == null) return { archived: b.archived, archivedAt: b.archivedAt };
  if (b.archivedAt == null) return { archived: a.archived, archivedAt: a.archivedAt };
  if (a.archivedAt !== b.archivedAt) {
    const winner = a.archivedAt > b.archivedAt ? a : b;
    return { archived: winner.archived, archivedAt: winner.archivedAt };
  }
  return { archived: a.archived || b.archived, archivedAt: a.archivedAt };
}

/** `a == null` / `b == null` aside, the earlier date wins — symmetric and order-independent,
 * matching `pickDeletedAt`'s own reasoning. */
function pickEarliestDate(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return a < b ? a : b;
}

/**
 * REDEEMED is terminal on both sides of a merge exactly as it is locally (recomputeQuestStatus
 * never touches a redeemed quest). The merged (deduped, see `dedupeConcurrentRedemptions`)
 * transactions are the primary source of truth: a surviving non-deleted redemption transaction
 * for this quest determines both the status and `questRedeemedDate` directly, independent of
 * argument order. Only if no such transaction survives (e.g. one predates this sync protocol, or
 * was deleted through the generic transaction-delete path) does this fall back to whichever
 * side's own `questStatus`/`questRedeemedDate` claims REDEEMED, picking the earlier date on
 * disagreement so the result stays the same regardless of which side is passed as `a` vs `b`.
 * Otherwise the status is fully re-derived from the merged transactions, the same source of truth
 * `withRecomputedQuestStatus` already uses after every local contribution add/delete — so a
 * contribution logged on one device while offline can still flip a quest to COMPLETED here.
 */
function mergeQuestStatus(a, b, mergedQuest, mergedTransactions, redemptionTx) {
  if (redemptionTx) {
    return { questStatus: 'redeemed', questRedeemedDate: redemptionTx.date };
  }
  if (a.questStatus === 'redeemed' || b.questStatus === 'redeemed') {
    return { questStatus: 'redeemed', questRedeemedDate: pickEarliestDate(a.questRedeemedDate, b.questRedeemedDate) };
  }
  return { questStatus: recomputeQuestStatus(mergedQuest, mergedTransactions), questRedeemedDate: null };
}

function mergeCategory(a, b, mergedTransactions, redemptionsByQuestId) {
  const base = { ...a, ...mergeArchived(a, b) };
  if (base.type !== 'quest') return base;
  return { ...base, ...mergeQuestStatus(a, b, base, mergedTransactions, redemptionsByQuestId.get(base.id)) };
}

function mergeCategories(localCategories, remoteCategories, mergedTransactions) {
  const redemptionsByQuestId = activeRedemptionsByQuestId(mergedTransactions);
  return unionById(localCategories, remoteCategories, (a, b) => mergeCategory(a, b, mergedTransactions, redemptionsByQuestId));
}

/**
 * Income categories have no edit or delete path at all (see domain/categories.js) — two copies
 * of the same id are assumed identical in content, so this is a plain union with no conflict to
 * resolve. Known accepted limitation: two devices each seeding their own default income
 * categories before ever pairing get different ids for the "same" category, so a first sync
 * between two independently-onboarded devices produces duplicates — content-based dedup is out
 * of scope here (mirrors the same additive-union-by-id design used for categories/transactions).
 */
function mergeIncomeCategories(localIncomeCategories, remoteIncomeCategories) {
  return unionById(localIncomeCategories, remoteIncomeCategories, (a) => a);
}

/** Most-recent `updatedAt` wins (see saveAllocations/ensureMonthSeeded); a row persisted before
 * `updatedAt` existed is treated as maximally stale (`?? 0`) so it always loses to a properly
 * stamped one. On an exact timestamp tie, the lexicographically smaller id wins — an explicit,
 * order-independent tie-break, not accidental array position. */
function pickNewerAllocation(a, b) {
  const at = a.updatedAt ?? 0;
  const bt = b.updatedAt ?? 0;
  if (at !== bt) return at > bt ? a : b;
  return a.id <= b.id ? a : b;
}

/**
 * Editing a month's budget hard-deletes the old rows for that (categoryId, month) and inserts
 * fresh ones (saveAllocations' own doc comment — no tombstone, unlike transactions/categories),
 * so two devices that each independently replace the same month end up with two different-id
 * rows for the same key. Ids essentially never collide across independently-created rows (both
 * use crypto.randomUUID), so the union step below is a plain merge; the real work is the
 * dedup-by-key pass afterward, enforcing the one-row-per-category-per-month invariant.
 */
function mergeBudgetAllocations(localAllocations, remoteAllocations) {
  const unioned = unionById(localAllocations, remoteAllocations, (a) => a);
  const byKey = new Map();
  for (const row of unioned) {
    const key = `${row.categoryId}:${row.month}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? pickNewerAllocation(existing, row) : row);
  }
  return [...byKey.values()];
}

/**
 * Merges `local` and `remote` — each `{ transactions, categories, incomeCategories,
 * budgetAllocations }` (a full state object, or just these four arrays) — into a patch of the
 * same four keys. Deterministic and idempotent: merging the same two inputs twice, or merging an
 * already-merged result back in, produces the same result as merging once (every conflict rule
 * above is itself idempotent and order-independent).
 */
export function mergeState(local, remote, lastSyncedAt = null) {
  void lastSyncedAt; // see module doc comment — accepted for API-contract reasons, unused today
  const transactions = mergeTransactions(local.transactions, remote.transactions);
  const categories = mergeCategories(local.categories, remote.categories, transactions);
  const incomeCategories = mergeIncomeCategories(local.incomeCategories, remote.incomeCategories);
  const budgetAllocations = mergeBudgetAllocations(local.budgetAllocations, remote.budgetAllocations);
  return { transactions, categories, incomeCategories, budgetAllocations };
}

/**
 * The four fields exchanged over the transport (ticket #20) — a subset of the full app state,
 * matching exactly what `mergeState` reads and returns. Kept as one function so the wire payload
 * and the merge input/output shape can never drift apart from each other.
 */
export function syncPayload(state) {
  return {
    transactions: state.transactions,
    categories: state.categories,
    incomeCategories: state.incomeCategories,
    budgetAllocations: state.budgetAllocations,
  };
}

/**
 * The full state patch to apply once a peer's `syncPayload` has actually arrived and been merged
 * (ticket #20) — the merged four arrays, plus this device's per-peer `lastSyncedAt` marker bumped
 * to `now`. Deliberately never called just because a connection was established: only a received
 * payload reaches this function, so a dropped transfer leaves `lastSyncedAt` untouched rather than
 * falsely marking itself synced.
 *
 * A hard no-op — `localState` returned completely unchanged — unless `senderId` (the sender's own
 * stable deviceId, stamped on the wire message by `buildStateMessage`) matches
 * `localState.pairedDevice.id` exactly, checked against `localState` itself rather than trusting
 * the caller to have already verified this against some other (possibly stale) value. That
 * matters because the caller (useNearbySync.js) reads state via a React effect closure that can
 * genuinely lag behind: re-pairing to a different device while still connected to the old one
 * leaves a window where the old device's listener is still registered and a real in-flight
 * message from it can still arrive after the pairing has already moved on — checking here,
 * against whatever `localState` this call is actually being applied to (via setState's updater
 * form, which is always current), is what actually closes that race rather than merely relocating
 * it. The same guard also covers the unpair case (`localState.pairedDevice` null never matches
 * any `senderId`) — e.g. right after Settings.jsx's confirmReset explicitly unpairs *because* it
 * just wiped local data, so a stray message from the old peer must not resurrect it.
 */
export function applyIncomingSync(localState, remotePayload, senderId, now = Date.now()) {
  if (localState.pairedDevice?.id !== senderId) return localState;
  const merged = mergeState(localState, remotePayload, localState.pairedDevice.lastSyncedAt);
  return { ...merged, pairedDevice: { ...localState.pairedDevice, lastSyncedAt: now } };
}

/**
 * How stale a sync has to be, with pending local changes outstanding, before the UI nudges the
 * user to open the app on their paired device (ticket #21). No Android precedent for this exact
 * number — sync is new to this app (#17-#20), not a ported feature — chosen to match the day-
 * granular cadence the rest of this app's reminders already use (see domain/reminders.js).
 */
export const STALE_SYNC_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** True if `timestamp` represents something touched after `lastSyncedAt` — null/undefined never
 * counts (nothing to compare), and a null `lastSyncedAt` (never synced) means anything with a
 * real timestamp counts. Shared by every field `pendingChangeCount` below checks. */
function touchedSinceSync(timestamp, lastSyncedAt) {
  return timestamp != null && (lastSyncedAt == null || timestamp > lastSyncedAt);
}

/**
 * How many local records were created or changed after the paired device's `lastSyncedAt` and
 * so haven't been confirmed to reach it yet (ticket #21). "Confirmed" is only as strong as the
 * marker itself already is (see applyIncomingSync's doc comment) — each device's own
 * `lastSyncedAt` advances when IT receives and merges the peer's payload, not from an explicit
 * ack of its own send, which in practice lands at essentially the same moment since both sends
 * fire together on connect (#20). Zero when unpaired — there's no peer to be behind on.
 *
 * Relies on `createdAt` existing on categories/incomeCategories (added for this ticket — see
 * domain/categories.js's seedDefaultsIfNeeded doc comment) and on budgetAllocations (added
 * alongside `updatedAt` in domain/allocations.js — the two answer different questions, see that
 * file's own note); a record from before these fields existed simply never counts as pending, the
 * same reasonable default `archivedAt ?? null` already uses elsewhere for pre-existing data.
 *
 * Known accepted limitation, inherent to every wall-clock timestamp this app already persists
 * (not something new here): if the two paired devices' clocks are meaningfully skewed, a record
 * created on the *other*, ahead-of-time device can carry a `createdAt` later than this device's
 * own just-stamped `lastSyncedAt`, permanently over-counting it as pending (and eventually
 * false-triggering the stale-sync nudge) even though it's genuinely synced. No worse than the
 * clock-skew exposure `archivedAt`/`deletedAt` LWW-merge already has in `mergeState` itself —
 * not fixed here, since a real fix needs a logical/vector clock, well beyond this ticket's scope.
 */
export function pendingChangeCount(state) {
  if (!state.pairedDevice) return 0;
  const lastSyncedAt = state.pairedDevice.lastSyncedAt;
  let count = 0;
  for (const t of state.transactions) {
    if (touchedSinceSync(t.createdAt, lastSyncedAt) || touchedSinceSync(t.deletedAt, lastSyncedAt)) count++;
  }
  for (const c of state.categories) {
    if (touchedSinceSync(c.createdAt, lastSyncedAt) || touchedSinceSync(c.archivedAt, lastSyncedAt)) count++;
  }
  for (const c of state.incomeCategories) {
    if (touchedSinceSync(c.createdAt, lastSyncedAt)) count++;
  }
  for (const a of state.budgetAllocations) {
    // createdAt, not updatedAt: ensureMonthSeeded deliberately carries an old updatedAt forward
    // on a mechanical month-copy (see its own doc comment — that's for merge priority, not this),
    // but always mints a genuinely new id+createdAt, so createdAt is the field that actually
    // answers "has the peer ever seen this row."
    if (touchedSinceSync(a.createdAt, lastSyncedAt)) count++;
  }
  return count;
}

/** "Synced just now" / "Synced Xm ago" / "Synced Xh ago" / "Synced Xd ago" / "Not yet synced" —
 * the Home indicator's exact copy (ticket #21). `now` is a parameter (not read internally) so
 * this stays pure and testable; the caller re-renders on a timer to keep it advancing live. */
export function formatSyncedLabel(lastSyncedAt, now = Date.now()) {
  if (lastSyncedAt == null) return 'Not yet synced';
  const minutes = Math.floor(Math.max(0, now - lastSyncedAt) / 60000);
  if (minutes < 1) return 'Synced just now';
  if (minutes < 60) return `Synced ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Synced ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Synced ${days}d ago`;
}

/**
 * True when the paired device should be nudged to open its app: there are pending local changes
 * and it's been at least `STALE_SYNC_THRESHOLD_MS` since the last successful sync — or since
 * pairing, if a sync has never happened at all. `pendingCount` defaults to a fresh
 * `pendingChangeCount(state)` call, but a caller that already computed it for its own display
 * (e.g. Home.jsx's "N pending" text) should pass it through rather than paying for the same
 * transactions/categories/incomeCategories/budgetAllocations scan twice per render.
 */
export function shouldNudgeStaleSync(state, now = Date.now(), pendingCount = pendingChangeCount(state)) {
  if (!state.pairedDevice) return false;
  if (pendingCount === 0) return false;
  const referencePoint = state.pairedDevice.lastSyncedAt ?? state.pairedDevice.pairedAt;
  return now - referencePoint >= STALE_SYNC_THRESHOLD_MS;
}
