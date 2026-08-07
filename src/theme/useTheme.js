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
