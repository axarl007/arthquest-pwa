/**
 * Whether a statement file shared into the app (ticket #40, Android share sheet) can open its
 * review screen right now. Unlike a widget/shortcut tap, a share carries data the user went out
 * of their way to send, so the caller *holds* it until this turns true rather than dropping it.
 * Deliberately conservative: it only opens over a tab screen or Settings' main screen, and waits
 * through onboarding (no categories yet), any open sheet (unsaved input), and every other
 * subscreen — an import review in progress, pairing (a QR scan), categories, a category/quest
 * detail (e.g. a redeem confirm) — rather than tearing any of them down.
 */
export function canOpenSharedStatement({ screen, sheet, settings, categoryDetail, questDetail }) {
  if (screen === 'onboarding' || sheet || categoryDetail || questDetail) return false;
  return settings === null || settings === 'main';
}
