import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, clearState, freshState, ensureDeviceId, STORAGE_KEY } from './persistence.js';

beforeEach(() => {
  localStorage.clear();
});

describe('freshState', () => {
  it('has sensible first-run defaults', () => {
    const s = freshState();
    expect(s.theme).toBe('dark');
    expect(s.iconStyle).toBe('cartoon');
    expect(s.onboarded).toBe(false);
    expect(s.categories).toEqual([]);
    expect(s.transactions).toEqual([]);
    expect(s.budgetAllocations).toEqual([]);
    expect(s.lastIncome).toBeNull();
  });
});

describe('loadState', () => {
  it('returns a fresh state when nothing is persisted', () => {
    expect(loadState()).toEqual(freshState());
  });

  it('returns fresh state when persisted JSON is corrupt', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');
    expect(loadState()).toEqual(freshState());
  });

  it('round-trips a saved state', () => {
    const s = { ...freshState(), theme: 'vibrant', categories: [{ id: 'c1', name: 'Housing' }] };
    saveState(s);
    expect(loadState()).toEqual(s);
  });

  it('merges persisted data over fresh defaults so new fields are never missing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data: { theme: 'vibrant' } }));
    const loaded = loadState();
    expect(loaded.theme).toBe('vibrant');
    expect(loaded.categories).toEqual([]);
  });
});

describe('clearState', () => {
  it('removes persisted data so the next load returns fresh state', () => {
    saveState({ ...freshState(), theme: 'vibrant' });
    clearState();
    expect(loadState()).toEqual(freshState());
  });
});

describe('ensureDeviceId', () => {
  it('returns a { deviceId } patch when the state has none', () => {
    const patch = ensureDeviceId(freshState());
    expect(Object.keys(patch)).toEqual(['deviceId']);
    expect(typeof patch.deviceId).toBe('string');
    expect(patch.deviceId).toBeTruthy();
  });

  it('returns null (nothing to patch) when a deviceId already exists', () => {
    const state = { ...freshState(), deviceId: 'already-set' };
    expect(ensureDeviceId(state)).toBeNull();
  });

  it('is pure — does not write to localStorage itself', () => {
    ensureDeviceId(freshState());
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('returns a minimal patch, not a full state snapshot — dispatching it must never clobber a sibling effect\'s concurrent state change (regression: this exact bug silently wiped Onboarding\'s freshly-seeded categories on first launch)', () => {
    const state = { ...freshState(), categories: [{ id: 'c1', name: 'Housing' }] };
    const patch = ensureDeviceId(state);
    const merged = { ...state, ...patch };
    expect(merged.categories).toEqual(state.categories);
  });
});
