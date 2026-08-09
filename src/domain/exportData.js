/**
 * JSON/CSV export+import, matching DataExportFormatter.kt's schema: the same four exportable
 * tables (categories/incomeCategories/transactions/budgetAllocations), the same field names, and
 * the same UPPERCASE enum casing (type/group/questStatus) — so a backup reads the same shape an
 * Android export would, even though the underlying ids are UUID strings here, not Room longs.
 * `settings` (theme/iconStyle/reminder toggles/onboarded) has no DataExportFormatter counterpart —
 * Android's export never touched AppPreferences — but ticket #6 explicitly wants it in the
 * round-trip, so it rides along as a fifth top-level key. Categories/income-categories also carry
 * one field beyond Android's own schema: the persisted `color` (see domain/categories.js) —
 * Android's CategoryEntity has no such column, but dropping it on export/import would silently
 * regress every re-imported category's Flat-style icon tint to the same fallback color, the exact
 * bug CLAUDE.md's data-model notes call out as having shipped once already.
 */

import { catColor } from '../theme/tokens.js';

const CATEGORY_TYPE_TO_EXPORT = { budget: 'BUDGET', quest: 'QUEST' };
const CATEGORY_TYPE_FROM_EXPORT = { BUDGET: 'budget', QUEST: 'quest' };
const GROUP_TO_EXPORT = { needs: 'NEEDS', wants: 'WANTS', savings: 'SAVINGS' };
const GROUP_FROM_EXPORT = { NEEDS: 'needs', WANTS: 'wants', SAVINGS: 'savings' };
const QUEST_STATUS_TO_EXPORT = { active: 'ACTIVE', completed: 'COMPLETED', redeemed: 'REDEEMED' };
const QUEST_STATUS_FROM_EXPORT = { ACTIVE: 'active', COMPLETED: 'completed', REDEEMED: 'redeemed' };
const TX_TYPE_TO_EXPORT = { income: 'INCOME', expense: 'EXPENSE', quest_contribution: 'QUEST_CONTRIBUTION' };
const TX_TYPE_FROM_EXPORT = { INCOME: 'income', EXPENSE: 'expense', QUEST_CONTRIBUTION: 'quest_contribution' };

function categoryToExport(c) {
  return {
    id: c.id, name: c.name, icon: c.icon, color: c.color, type: CATEGORY_TYPE_TO_EXPORT[c.type], group: GROUP_TO_EXPORT[c.group],
    archived: c.archived, archivedAt: c.archivedAt ?? null, questTargetAmount: c.questTargetAmount ?? null, questTargetDate: c.questTargetDate ?? null,
    questStatus: c.questStatus ? QUEST_STATUS_TO_EXPORT[c.questStatus] : null, questRedeemedDate: c.questRedeemedDate ?? null,
  };
}

function categoryFromExport(c) {
  return {
    id: c.id, name: c.name, icon: c.icon, color: c.color, type: CATEGORY_TYPE_FROM_EXPORT[c.type], group: GROUP_FROM_EXPORT[c.group],
    archived: c.archived, archivedAt: c.archivedAt ?? null, questTargetAmount: c.questTargetAmount ?? null, questTargetDate: c.questTargetDate ?? null,
    questStatus: c.questStatus ? QUEST_STATUS_FROM_EXPORT[c.questStatus] : null, questRedeemedDate: c.questRedeemedDate ?? null,
  };
}

function transactionToExport(t) {
  return {
    id: t.id, type: TX_TYPE_TO_EXPORT[t.type], amount: t.amount, date: t.date, createdAt: t.createdAt,
    categoryId: t.categoryId ?? null, incomeCategoryId: t.incomeCategoryId ?? null,
    description: t.description ?? '', isRedemption: t.isRedemption,
  };
}

function transactionFromExport(t) {
  return {
    id: t.id, type: TX_TYPE_FROM_EXPORT[t.type], amount: t.amount, date: t.date, createdAt: t.createdAt,
    categoryId: t.categoryId ?? null, incomeCategoryId: t.incomeCategoryId ?? null,
    description: t.description ?? '', isRedemption: t.isRedemption,
  };
}

/** Full backup as a pretty-printed JSON string — mirrors DataExportService.buildBackupJson(). */
export function buildBackupJson(state) {
  const backup = {
    categories: state.categories.map(categoryToExport),
    incomeCategories: state.incomeCategories.map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })),
    // Tombstoned transactions (see domain/transactions.js's deleteTransaction) are excluded — a
    // backup is a single-device restore point, not a sync payload, so there's no merge to protect
    // against here; keeping them out matches Android's DataExportFormatter, which has no delete
    // concept in its schema at all.
    transactions: state.transactions.filter((t) => !t.deletedAt).map(transactionToExport),
    budgetAllocations: state.budgetAllocations.map((a) => ({ ...a })),
    settings: {
      theme: state.theme, iconStyle: state.iconStyle, onboarded: state.onboarded,
      settingsToggles: { ...state.settingsToggles }, lastBackupReminderDate: state.lastBackupReminderDate ?? null,
    },
  };
  return JSON.stringify(backup, null, 2);
}

/**
 * Parses a JSON backup back into a `state` patch — the inverse of buildBackupJson, tolerant of a
 * missing `settings` key (an Android-produced export wouldn't have one) so importing a
 * data-only backup still restores everything it can rather than failing outright. Throws on
 * anything that isn't a recognizable backup shape.
 */
export function parseBackupJson(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions)) {
    throw new Error('Not a recognizable ArthQuest backup file.');
  }
  const patch = {
    categories: parsed.categories.map(categoryFromExport),
    incomeCategories: (parsed.incomeCategories ?? []).map((c) => ({ id: c.id, name: c.name, icon: c.icon, color: c.color })),
    transactions: parsed.transactions.map(transactionFromExport),
    budgetAllocations: (parsed.budgetAllocations ?? []).map((a) => ({ ...a })),
  };
  // A genuinely Android-produced export (or any hand-edited backup) has no `color` field at all —
  // assign one the same way seedDefaultsIfNeeded() does for a newly-created category, continuing
  // the index across categories then income categories, rather than leaving it undefined (which
  // would blank out every imported category's Flat-style icon tint).
  let colorIndex = 0;
  for (const c of [...patch.categories, ...patch.incomeCategories]) {
    if (!c.color) c.color = catColor(colorIndex);
    colorIndex++;
  }
  if (parsed.settings) {
    if (parsed.settings.theme) patch.theme = parsed.settings.theme;
    if (parsed.settings.iconStyle) patch.iconStyle = parsed.settings.iconStyle;
    if (typeof parsed.settings.onboarded === 'boolean') patch.onboarded = parsed.settings.onboarded;
    if (parsed.settings.settingsToggles) patch.settingsToggles = { ...parsed.settings.settingsToggles };
    if (parsed.settings.lastBackupReminderDate) patch.lastBackupReminderDate = parsed.settings.lastBackupReminderDate;
  }
  return patch;
}

function csvField(value) {
  const str = String(value);
  return /[,"\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Transactions-only CSV, columns matching DataExportFormatter.toTransactionsCsv exactly. */
export function buildTransactionsCsv(state) {
  const categoryNameById = new Map(state.categories.map((c) => [c.id, c.name]));
  const incomeCategoryNameById = new Map(state.incomeCategories.map((c) => [c.id, c.name]));
  const header = ['Date', 'Type', 'Category', 'Description', 'Amount'].join(',');
  const rows = state.transactions.filter((t) => !t.deletedAt).map((t) => {
    const categoryName = t.type === 'income'
      ? incomeCategoryNameById.get(t.incomeCategoryId) ?? ''
      : categoryNameById.get(t.categoryId) ?? '';
    return [t.date, TX_TYPE_TO_EXPORT[t.type], categoryName, t.description ?? '', String(t.amount)]
      .map(csvField).join(',');
  });
  return [header, ...rows].join('\n');
}
