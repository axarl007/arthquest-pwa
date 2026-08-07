import { describe, it, expect } from 'vitest';
import { catColor, semanticColors, themeTokens, HUES } from './tokens.js';

describe('catColor', () => {
  it('cycles through the fixed hue palette by index', () => {
    expect(catColor(0)).toBe(`oklch(0.62 0.13 ${HUES[0]})`);
    expect(catColor(HUES.length)).toBe(catColor(0));
  });
});

describe('semanticColors', () => {
  it('returns dark-theme semantic colors by default', () => {
    const c = semanticColors('dark');
    expect(c.accent).toBe('oklch(0.72 0.14 245)');
    expect(c.danger).toBe('oklch(0.68 0.19 25)');
  });
  it('returns vibrant-theme semantic colors', () => {
    const c = semanticColors('vibrant');
    expect(c.accent).toBe('oklch(0.5 0.17 245)');
  });
});

describe('themeTokens', () => {
  it('returns dark tokens by default', () => {
    const t = themeTokens('dark');
    expect(t.frameBg).toBe('oklch(0.17 0.02 265)');
    expect(t.onAccentText).toBe('oklch(0.14 0.02 265)');
  });
  it('returns vibrant tokens', () => {
    const t = themeTokens('vibrant');
    expect(t.frameBg).toBe('oklch(0.96 0.015 85)');
    expect(t.onAccentText).toBe('oklch(0.99 0.01 265)');
  });
});
