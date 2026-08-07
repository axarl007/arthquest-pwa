import { describe, it, expect, beforeEach } from 'vitest';
import { loadState, saveState, clearState, freshState, STORAGE_KEY } from './persistence.js';

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
