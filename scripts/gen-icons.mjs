// Generates the PWA app icon set (favicon, 192/512, maskable, apple-touch)
// from a hand-built SVG using the app's own oklch design tokens converted to
// exact sRGB hex (scripts/oklch.mjs) — the quest-progress-ring motif already
// used throughout the UI (Home quest cards, Quest detail), not a generic logo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { tokenToHex } from './oklch.mjs';
import { themeTokens, semanticColors } from '../src/theme/tokens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/pwa-icons');
mkdirSync(OUT_DIR, { recursive: true });

// Same dark-theme tokens the app itself renders with — retuning tokens.js
// retunes the generated icon too, no literals to keep in sync by hand.
const T = themeTokens('dark');
const C = semanticColors('dark');
const bg = tokenToHex(T.frameBg);
const track = tokenToHex(T.trackBg);
const accent = tokenToHex(C.accent);
const quest = tokenToHex(C.quest);
const glyph = tokenToHex(T.text); // light, for contrast against frameBg

// Progress ring geometry: ~72% arc, matching the conic-gradient ring style
// used for quest-progress rings elsewhere in the app.
const cx = 256, cy = 256, r = 176, stroke = 56;
const pct = 0.72;
const circumference = 2 * Math.PI * r;
const dash = circumference * pct;

function buildSvg({ maskable }) {
  // Maskable icons need content inside the safe-zone circle (40% of the
  // shortest side from center) so Android's mask crop never clips it.
  const scale = maskable ? 0.72 : 1;

  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="${bg}"/>
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

const targets = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'maskable-192.png', size: 192, maskable: true },
  { file: 'maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false },
  { file: 'favicon-32.png', size: 32, maskable: false },
  { file: 'favicon-16.png', size: 16, maskable: false },
];

for (const t of targets) {
  const svg = buildSvg({ maskable: t.maskable });
  await sharp(Buffer.from(svg)).resize(t.size, t.size).png().toFile(path.join(OUT_DIR, t.file));
  console.log('wrote', t.file);
}

// A crisp source SVG too (used as the tab favicon — scales perfectly).
writeFileSync(path.join(OUT_DIR, 'icon.svg'), buildSvg({ maskable: false }));
console.log('wrote icon.svg');
