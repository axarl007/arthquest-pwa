import { describe, it, expect } from 'vitest';
import { canOpenSharedStatement } from './sharedStatement.js';

describe('canOpenSharedStatement', () => {
  const idle = { screen: 'home', sheet: null, settings: null, categoryDetail: null, questDetail: null };

  it('opens over a tab screen or Settings\' main screen', () => {
    expect(canOpenSharedStatement(idle)).toBe(true);
    expect(canOpenSharedStatement({ ...idle, screen: 'budget' })).toBe(true);
    expect(canOpenSharedStatement({ ...idle, settings: 'main' })).toBe(true);
  });

  it('waits during onboarding (no categories to pick from yet, and its JSX renders no review screen)', () => {
    expect(canOpenSharedStatement({ ...idle, screen: 'onboarding' })).toBe(false);
  });

  it('waits while a sheet is open, so its unsaved input is not lost', () => {
    expect(canOpenSharedStatement({ ...idle, sheet: { type: 'log' } })).toBe(false);
  });

  it('waits while any other subscreen is open (an import review, pairing/QR scan, categories, a detail screen)', () => {
    for (const settings of ['import', 'import-direct', 'pairing', 'pairing-direct', 'categories']) {
      expect(canOpenSharedStatement({ ...idle, settings })).toBe(false);
    }
    expect(canOpenSharedStatement({ ...idle, categoryDetail: { categoryId: 'c' } })).toBe(false);
    expect(canOpenSharedStatement({ ...idle, questDetail: { questId: 'q' } })).toBe(false);
  });
});
