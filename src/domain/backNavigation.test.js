import { describe, it, expect } from 'vitest';
import { resolveBackTarget } from './backNavigation.js';

const base = { sheet: null, categoryDetail: null, questDetail: null, settings: null, screen: 'home' };

describe('resolveBackTarget', () => {
  it('closes an open sheet first, regardless of what else is open', () => {
    expect(resolveBackTarget({ ...base, sheet: { type: 'log' }, questDetail: { questId: 'q1' } })).toBe('sheet');
  });

  it('backs out of an open category detail subscreen', () => {
    expect(resolveBackTarget({ ...base, categoryDetail: { categoryId: 'c1', monthKey: '2026-08' } })).toBe(
      'categoryDetail',
    );
  });

  it('backs out of an open quest detail subscreen', () => {
    expect(resolveBackTarget({ ...base, questDetail: { questId: 'q1' } })).toBe('questDetail');
  });

  it('backs out of an open settings subscreen', () => {
    expect(resolveBackTarget({ ...base, settings: 'categories' })).toBe('settings');
  });

  it('switches to home from any other tab when nothing is open', () => {
    expect(resolveBackTarget({ ...base, screen: 'budget' })).toBe('home');
    expect(resolveBackTarget({ ...base, screen: 'transactions' })).toBe('home');
    expect(resolveBackTarget({ ...base, screen: 'quests' })).toBe('home');
  });

  it('exits the app when already at home with nothing open', () => {
    expect(resolveBackTarget({ ...base, screen: 'home' })).toBe('exit');
  });

  it('never resolves to home/exit while a subscreen or sheet is open, even off the home tab', () => {
    expect(resolveBackTarget({ ...base, screen: 'budget', categoryDetail: { categoryId: 'c1', monthKey: '2026-08' } })).toBe(
      'categoryDetail',
    );
  });
});
