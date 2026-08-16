const QUICK_ADD_HOST = 'add-transaction';

/**
 * True if `url` is the home-screen widget's quick-add deep link (ticket #32) — matched by the
 * authority/host component of the URL (works for any scheme, since the native side uses
 * `custom_url_scheme` from strings.xml rather than a hardcoded one here) so a trailing path or
 * query string doesn't break the match.
 */
export function isQuickAddDeepLink(url) {
  if (!url) return false;
  try {
    return new URL(url).hostname === QUICK_ADD_HOST;
  } catch {
    return false;
  }
}
