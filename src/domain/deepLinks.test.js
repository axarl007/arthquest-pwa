import { describe, it, expect } from 'vitest';
import { isQuickAddDeepLink } from './deepLinks.js';

describe('isQuickAddDeepLink', () => {
  it('matches the widget quick-add deep link regardless of scheme', () => {
    expect(isQuickAddDeepLink('com.arthquest.pwa://add-transaction')).toBe(true);
  });

  it('matches even with a trailing path or query string', () => {
    expect(isQuickAddDeepLink('com.arthquest.pwa://add-transaction/')).toBe(true);
    expect(isQuickAddDeepLink('com.arthquest.pwa://add-transaction?source=widget')).toBe(true);
  });

  it('rejects an unrelated host', () => {
    expect(isQuickAddDeepLink('com.arthquest.pwa://something-else')).toBe(false);
  });

  it('rejects nullish/empty input without throwing', () => {
    expect(isQuickAddDeepLink(null)).toBe(false);
    expect(isQuickAddDeepLink(undefined)).toBe(false);
    expect(isQuickAddDeepLink('')).toBe(false);
  });

  it('rejects a malformed URL without throwing', () => {
    expect(isQuickAddDeepLink('not a url')).toBe(false);
  });
});
