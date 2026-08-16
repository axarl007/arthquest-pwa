import { describe, it, expect } from 'vitest';
import { deepLinkAction } from './deepLinks.js';

describe('deepLinkAction', () => {
  it('recognizes each app-shortcut/widget action regardless of scheme', () => {
    expect(deepLinkAction('com.arthquest.pwa://add-transaction')).toBe('add-transaction');
    expect(deepLinkAction('com.arthquest.pwa://add-category')).toBe('add-category');
    expect(deepLinkAction('com.arthquest.pwa://new-quest')).toBe('new-quest');
  });

  it('matches even with a trailing path or query string', () => {
    expect(deepLinkAction('com.arthquest.pwa://add-transaction/')).toBe('add-transaction');
    expect(deepLinkAction('com.arthquest.pwa://new-quest?source=shortcut')).toBe('new-quest');
  });

  it('returns null for an unrelated host', () => {
    expect(deepLinkAction('com.arthquest.pwa://something-else')).toBe(null);
  });

  it('returns null for nullish/empty input without throwing', () => {
    expect(deepLinkAction(null)).toBe(null);
    expect(deepLinkAction(undefined)).toBe(null);
    expect(deepLinkAction('')).toBe(null);
  });

  it('returns null for a malformed URL without throwing', () => {
    expect(deepLinkAction('not a url')).toBe(null);
  });
});
