/**
 * Priority order for the native Android back button/gesture (ticket #29) — mirrors exactly what
 * tapping the currently-visible on-screen back/close control would do, so the hardware/gesture
 * back never skips a level or exits the app from mid-flow. Sheets outrank subscreens (a sheet can
 * be opened from a subscreen, e.g. Quest detail's "contribute" sheet), and no combination ever
 * resolves to 'home'/'exit' while a sheet or subscreen is open, even off the home tab.
 */
export function resolveBackTarget({ sheet, categoryDetail, questDetail, settings, screen }) {
  if (sheet) return 'sheet';
  if (categoryDetail) return 'categoryDetail';
  if (questDetail) return 'questDetail';
  if (settings) return 'settings';
  if (screen !== 'home') return 'home';
  return 'exit';
}
