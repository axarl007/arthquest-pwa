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
    income: 0,
    categories: [],
    incomeCategories: [],
    transactions: [],
    quests: [],
    settingsToggles: { daily: true, monthEnd: true, backup: false, review: true },
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
