/**
 * Learned payee → category memory for statement import (ticket #37). Deliberately no keyword
 * dictionary or guessing: categories are user-defined, so the only reliable signal is what this
 * user picked for this payee last time — and a wrong prefill gets bulk-submitted unread.
 *
 * `state.payeeCategoryMap` = `{ [key]: { type, categoryId, updatedAt } }`. `categoryId` names an
 * income category when `type` is 'income' and a budget category/quest otherwise — the same split
 * a transaction stores across categoryId/incomeCategoryId, folded into one field since `type`
 * already disambiguates. An undone import leaves a cleared `{ type: null, categoryId: null }` entry
 * (see undoImport) rather than deleting the key, so the undo wins sync merges. The key includes the direction (see payeeMemoryKey) so paying someone and
 * being paid back by them are remembered separately, matching how the review screen groups rows.
 */
import { normalizePayee, defaultTypeForDirection } from './statementImport.js';
import { categoryOptionsForType } from './categoryOptions.js';

export function payeeMemoryKey(row) {
  const normalized = normalizePayee(row.payee);
  return normalized ? `${row.direction}:${normalized}` : null;
}

/**
 * Returns `map` updated with every included row's final choice, stamped `now`. Only called on
 * import submit (manual transactions never teach it — free-text descriptions are mostly noise).
 * Rows are applied oldest-first so when one file has conflicting choices for the same payee, the
 * most recent transaction's choice is what's remembered.
 */
export function learnPayeeCategories(map, rows, assignments, now) {
  const next = { ...map };
  const chronological = rows
    .map((r, index) => ({ r, index }))
    .sort((a, b) => {
      const ka = `${a.r.date} ${a.r.time}`;
      const kb = `${b.r.date} ${b.r.time}`;
      if (ka !== kb) return ka < kb ? -1 : 1;
      return b.index - a.index; // statements list newest first
    });
  for (const { r } of chronological) {
    const a = assignments[r.externalId];
    const key = payeeMemoryKey(r);
    if (!key || !a || a.skip || a.categoryId == null) continue;
    next[key] = { type: a.type, categoryId: a.categoryId, updatedAt: now };
  }
  return next;
}

/**
 * Initial review assignments: each row's remembered type+category when that category is still
 * selectable (not archived/deleted, not a redeemed quest), otherwise its direction's default type
 * with no category — a stale memory is ignored, never shown.
 */
export function prefillAssignments(rows, map, state) {
  const memory = map ?? {};
  return Object.fromEntries(rows.map((r) => {
    const fallback = { type: defaultTypeForDirection(r.direction), categoryId: null, skip: false };
    const key = payeeMemoryKey(r);
    const entry = key ? memory[key] : null;
    const usable = entry && categoryOptionsForType(entry.type, state).some((o) => o.id === entry.categoryId);
    return [r.externalId, usable ? { type: entry.type, categoryId: entry.categoryId, skip: false } : fallback];
  }));
}
