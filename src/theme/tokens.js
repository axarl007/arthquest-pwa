export const HUES = [245, 150, 28, 300, 95, 205, 340, 175, 55];

/** Deterministic per-category accent color, cycling through the fixed hue palette. */
export function catColor(i) {
  return 'oklch(0.62 0.13 ' + HUES[i % HUES.length] + ')';
}

/**
 * Fixed accent used for every quest-related icon/pill regardless of theme or which quest it is
 * (the design spec uses this one constant everywhere a quest needs a color, as distinct from a
 * budget category's own per-category `catColor`).
 */
export const QUEST_COLOR = 'oklch(0.62 0.13 300)';

/** Fixed gold used for "completed"/"redeemed" quest states — rings, badges, redemption rows. */
export const GOLD_COLOR = 'oklch(0.8 0.13 85)';

/** Neutral fallback for a transaction whose category/quest/income-source has since been deleted. */
export const DELETED_REF_COLOR = 'oklch(0.5 0.02 265)';

export function semanticColors(theme) {
  if (theme === 'vibrant') {
    return {
      income: 'oklch(0.5 0.16 150)', expense: 'oklch(0.52 0.19 25)', quest: 'oklch(0.52 0.16 300)',
      accent: 'oklch(0.5 0.17 245)', warn: 'oklch(0.55 0.17 80)', danger: 'oklch(0.5 0.2 25)', safe: 'oklch(0.48 0.17 150)',
    };
  }
  return {
    income: 'oklch(0.75 0.15 150)', expense: 'oklch(0.72 0.17 25)', quest: 'oklch(0.74 0.13 300)',
    accent: 'oklch(0.72 0.14 245)', warn: 'oklch(0.8 0.15 95)', danger: 'oklch(0.68 0.19 25)', safe: 'oklch(0.72 0.15 150)',
  };
}

export function themeTokens(theme) {
  if (theme === 'vibrant') {
    return {
      pageBg: 'radial-gradient(circle at 50% 0%, oklch(0.97 0.02 85), oklch(0.92 0.03 70))',
      frameBg: 'oklch(0.96 0.015 85)',
      heroGradient: 'linear-gradient(155deg, oklch(0.64 0.16 245), oklch(0.56 0.17 300))',
      card: 'oklch(0.995 0.004 85)', cardBorder: '1px solid oklch(0.9 0.015 80)',
      cardMuted: 'oklch(0.97 0.01 85)',
      sheetBg: 'oklch(0.985 0.006 85)',
      lockedBanner: 'oklch(0.93 0.02 80)',
      btnSecondaryBg: 'oklch(0.93 0.015 80)', btnSecondaryBgAlt: 'oklch(0.9 0.015 80)',
      inputBg: 'oklch(0.93 0.015 80)',
      text: 'oklch(0.22 0.02 265)', textSecondary: 'oklch(0.4 0.02 265)', textTertiary: 'oklch(0.55 0.015 265)',
      border: 'oklch(0.87 0.015 80)', trackBg: 'oklch(0.89 0.015 80)',
      disabledBg: 'oklch(0.88 0.015 80)', disabledText: 'oklch(0.65 0.02 265)',
      onAccentText: 'oklch(0.99 0.01 265)',
    };
  }
  return {
    pageBg: 'radial-gradient(circle at 50% 0%, oklch(0.16 0.02 265), oklch(0.09 0.01 265))',
    frameBg: 'oklch(0.17 0.02 265)',
    heroGradient: 'linear-gradient(155deg, oklch(0.34 0.09 245), oklch(0.24 0.06 260))',
    card: 'oklch(0.21 0.02 265)', cardBorder: 'none',
    cardMuted: 'oklch(0.19 0.015 265)',
    sheetBg: 'oklch(0.19 0.02 265)',
    lockedBanner: 'oklch(0.24 0.03 265)',
    btnSecondaryBg: 'oklch(0.23 0.02 265)', btnSecondaryBgAlt: 'oklch(0.28 0.02 265)',
    inputBg: 'oklch(0.26 0.02 265)',
    text: 'oklch(0.96 0.01 265)', textSecondary: 'oklch(0.68 0.02 265)', textTertiary: 'oklch(0.58 0.02 265)',
    border: 'oklch(0.36 0.02 265)', trackBg: 'oklch(0.32 0.02 265)',
    disabledBg: 'oklch(0.3 0.02 265)', disabledText: 'oklch(0.5 0.02 265)',
    onAccentText: 'oklch(0.14 0.02 265)',
  };
}
