import { makeId } from '../domain/categories.js';

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
    // The raw income figure typed into Onboarding, kept only so re-entering the income-split flow
    // (Settings > "Redo income split") can prefill it instead of forcing a blank ₹0 re-type every
    // time — has no Android/budgetAllocations equivalent, since the derived per-category `amount`s
    // above already capture everything the app itself needs. Deliberately NOT preserved across a
    // full data reset (see Settings.jsx's confirmReset) — a reset is "start over," so Onboarding
    // starting blank there is correct; only in-place re-entry should see the prior value.
    lastIncome: null,
    transactions: [],
    // Every reminder toggle defaults on, matching AppPreferences' own `?: true` fallback for all
    // four (backupReminderEnabled included — a prior default of false here was a ticket #1
    // oversight, not a deliberate divergence like theme/iconStyle's).
    settingsToggles: { daily: true, monthEnd: true, backup: true, review: true },
    // Last date the periodic backup reminder actually fired (see domain/reminders.js) — lets that
    // reminder derive "periodic" from elapsed time, matching AppPreferences.lastBackupReminderDate.
    lastBackupReminderDate: null,
    // This device's own stable identity (ticket #17) — deliberately left null here since
    // freshState() must stay pure (no randomness/side effects); StoreContext.jsx's mount effect
    // calls ensureDeviceId below and dispatches its patch so the actual write happens as a normal
    // state update, not inside the useReducer lazy initializer (loadState), which React's
    // StrictMode double-invokes in development specifically to catch impure initializers.
    deviceId: null,
    deviceName: 'My Phone',
    // { id, name, pairedAt } | null — single paired device for v1, no data transport yet (#17).
    pairedDevice: null,
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

/**
 * Returns a `{ deviceId }` patch if this device doesn't have one yet, or null if it already does
 * — a pure function (no storage access), called from a mount effect (see StoreContext.jsx) rather
 * than from loadState itself, so persisting it goes through the normal setState -> saveState
 * effect path instead of a side effect hidden inside a lazy initializer.
 *
 * Deliberately returns a minimal patch, not a full state object: StoreContext's reducer merges
 * whatever's dispatched over the *current* state at dispatch time (`{...state, ...patch}`), and
 * mount effects from multiple components (e.g. this one and Onboarding's category-seeding effect)
 * can both fire within the same commit. Dispatching a full stale `state` snapshot here previously
 * clobbered whatever a sibling effect had just written moments earlier — on a fresh install, this
 * silently reverted Onboarding's just-seeded default categories back to `[]` — so this returns
 * only the field that actually changed.
 *
 * Known accepted limitation: two tabs of the same browser PWA opened simultaneously on the very
 * first-ever load can each generate a different id before either write lands, and the later
 * write wins — the primary target (the native Android app from ticket #15) only ever runs one
 * instance, so this doesn't apply there. A proper cross-tab lock (the Web Locks API) is available
 * but not worth the added complexity for an edge case limited to the secondary browser-PWA
 * deployment.
 */
export function ensureDeviceId(state) {
  if (state.deviceId) return null;
  return { deviceId: makeId() };
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
