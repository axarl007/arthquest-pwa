// Generates the PWA app icon set (favicon, 192/512, maskable, apple-touch)
// from a hand-built SVG using the app's own oklch design tokens converted to
// exact sRGB hex (scripts/oklch.mjs) — the quest-progress-ring motif already
// used throughout the UI (Home quest cards, Quest detail), not a generic logo.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { buildIconSvg } from './icon-motif.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../public/pwa-icons');
mkdirSync(OUT_DIR, { recursive: true });

// Maskable icons need content inside the safe-zone circle (40% of the shortest side from center)
// so Android/PWA install-icon mask crops never clip it — see buildIconSvg's `maskable` option.
const buildSvg = ({ maskable }) => buildIconSvg({ maskable });

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
