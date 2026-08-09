// The app's quest-progress-ring icon motif, shared by gen-icons.mjs (PWA icon set) and
// gen-android-icons.mjs (native Capacitor launcher/adaptive/splash icons) so both platforms render
// the exact same artwork from the same live theme tokens instead of two hand-kept copies.
import { tokenToHex } from './oklch.mjs';
import { themeTokens, semanticColors } from '../src/theme/tokens.js';

export function motifColors() {
  const T = themeTokens('dark');
  const C = semanticColors('dark');
  return {
    bg: tokenToHex(T.frameBg),
    track: tokenToHex(T.trackBg),
    accent: tokenToHex(C.accent),
    quest: tokenToHex(C.quest),
    glyph: tokenToHex(T.text),
  };
}

const cx = 256, cy = 256, r = 176, stroke = 56;
const pct = 0.72;
const circumference = 2 * Math.PI * r;
const dash = circumference * pct;

/**
 * `maskable` insets the ring into a safe-zone circle (72% scale) so a circular/adaptive-icon mask
 * never clips it. `transparent` omits the background rect — used for Android adaptive icon
 * foreground layers, which are composited over a separate solid-color background layer.
 */
export function buildIconSvg({ maskable = false, transparent = false } = {}) {
  const { bg, track, accent, quest, glyph } = motifColors();
  const scale = maskable ? 0.72 : 1;

  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  ${transparent ? '' : `<rect width="512" height="512" fill="${bg}"/>`}
  <g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${accent}" stroke-width="${stroke}"
      stroke-linecap="round" stroke-dasharray="${dash} ${circumference}"
      transform="rotate(-90 ${cx} ${cy})"/>
    <circle cx="${cx + r * Math.cos(2 * Math.PI * pct - Math.PI / 2)}"
      cy="${cy + r * Math.sin(2 * Math.PI * pct - Math.PI / 2)}"
      r="${stroke * 0.42}" fill="${quest}"/>
    <text x="${cx}" y="${cy}" font-family="Arial, Helvetica, sans-serif" font-weight="800"
      font-size="176" fill="${glyph}" text-anchor="middle" dominant-baseline="central">A</text>
  </g>
</svg>`;
}
