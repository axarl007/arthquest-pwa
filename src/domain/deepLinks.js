// Recognized deep-link actions, shared by the home-screen widget (ticket #33) and the native
// launcher-icon app shortcuts (ticket #34) — both are just different native entry points onto the
// same three targets, so they share one action vocabulary rather than each defining their own.
const DEEP_LINK_ACTIONS = new Set(['add-transaction', 'add-category', 'new-quest']);

/**
 * Extracts the recognized deep-link action from `url`'s authority/host component (works for any
 * scheme, since the native side uses `custom_url_scheme` from strings.xml rather than a hardcoded
 * one here), ignoring any trailing path or query string. Returns null for anything unrecognized,
 * nullish, or malformed — never throws.
 */
export function deepLinkAction(url) {
  if (!url) return null;
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  return DEEP_LINK_ACTIONS.has(hostname) ? hostname : null;
}
