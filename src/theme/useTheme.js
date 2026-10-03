import { useMemo } from 'react';
import { useStore } from '../store/useStore.js';
import { themeTokens, semanticColors } from './tokens.js';

/** Derives the current theme's design tokens + semantic colors from persisted state. */
export function useTheme() {
  const { state } = useStore();
  const theme = state.theme;
  const iconStyle = state.iconStyle;
  return useMemo(
    () => ({ theme, iconStyle, T: themeTokens(theme), C: semanticColors(theme) }),
    [theme, iconStyle],
  );
}

/**
 * CSS `color-scheme` value for the app's current theme, for native browser controls (e.g.
 * `<input type="date">`) whose popup/affordance chrome is UA-drawn and doesn't otherwise pick up
 * this app's own dark/vibrant tokens. Single source of truth so every native-control call site
 * stays in sync if the theme set ever changes, instead of each one hardcoding its own ternary.
 */
export function nativeColorScheme(theme) {
  return theme === 'vibrant' ? 'light' : 'dark';
}
