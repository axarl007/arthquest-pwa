export const STORAGE_KEY = 'arthquest.state';
const VERSION = 1;

/**
 * Durable app data — everything that survives a reload. Deliberately excludes
 * ephemeral UI state (current screen, open sheet, in-progress form fields),
 * which lives in React state instead. Later tickets add fields here; loadState
 * merges persisted data over these defaults so old saved blobs never crash on
 * a missing field.
 */
export function freshState() {
  return {
    onboarded: false,
    theme: 'dark',
    iconStyle: 'cartoon',
    // Categories (type: 'budget' | 'quest') live in one array, mirroring the Android app's
    // single `categories` table — a Quest is a category with quest* fields set, not a separate
    // collection. Income categories are a genuinely separate table on both sides.
    categories: [],
    incomeCategories: [],
    // Per-month allocation rows ({ id, categoryId, month: 'YYYY-MM', percentage, amount }) — the
    // Android app has no persisted "current income" figure at all, only these computed amounts;
    // spent/contributed totals are likewise never stored, always derived from `transactions`.
    budgetAllocations: [],
    transactions: [],
    // Every reminder toggle defaults on, matching AppPreferences' own `?: true` fallback for all
    // four (backupReminderEnabled included — a prior default of false here was a ticket #1
    // oversight, not a deliberate divergence like theme/iconStyle's).
    settingsToggles: { daily: true, monthEnd: true, backup: true, review: true },
    // Last date the periodic backup reminder actually fired (see domain/reminders.js) — lets that
    // reminder derive "periodic" from elapsed time, matching AppPreferences.lastBackupReminderDate.
    lastBackupReminderDate: null,
  };
}

export function loadState() {
  const fresh = freshState();
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return fresh;
  }
  if (!raw) return fresh;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return fresh;
    return { ...fresh, ...parsed.data };
  } catch {
    return fresh;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, data: state }));
  } catch {
    // Storage full or unavailable (private browsing, quota) — fail silently,
    // the in-memory state still works for the current session.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
