// Generates Capacitor's native Android launcher icons (legacy + adaptive) and splash screens from
// the same quest-progress-ring motif as the PWA icon set (scripts/icon-motif.mjs), replacing
// Capacitor's generic template artwork — CLAUDE.md decision #4: the app icon is custom-designed
// from the live theme tokens, never a generic/placeholder logo, on any platform.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { buildIconSvg, motifColors } from './icon-motif.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RES_DIR = path.join(__dirname, '../android/app/src/main/res');

if (!existsSync(RES_DIR)) {
  // `npx cap add android` hasn't been run yet (e.g. a fresh checkout before the platform is first
  // added) — nothing to write into, and a plain `npm install` shouldn't fail over it.
  console.log('android/app/src/main/res not found, skipping Android icon generation');
  process.exit(0);
}

const DENSITIES = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

const legacySvg = buildIconSvg({ maskable: false });
const roundSvg = buildIconSvg({ maskable: true });
const foregroundSvg = buildIconSvg({ maskable: true, transparent: true });

for (const { dir, size } of DENSITIES) {
  const outDir = path.join(RES_DIR, dir);
  mkdirSync(outDir, { recursive: true });
  await sharp(Buffer.from(legacySvg)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher.png'));
  await sharp(Buffer.from(roundSvg)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_round.png'));
  await sharp(Buffer.from(foregroundSvg)).resize(size, size).png().toFile(path.join(outDir, 'ic_launcher_foreground.png'));
  console.log(`wrote ${dir} launcher icons`);
}

// Adaptive icon background layer (mipmap-anydpi-v26/ic_launcher.xml references this by name) — a
// solid color matching the app's own dark frame background, not Capacitor's default white.
const { bg } = motifColors();
const colorsXmlPath = path.join(RES_DIR, 'values/ic_launcher_background.xml');
writeFileSync(colorsXmlPath, `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${bg}</color>\n</resources>\n`);
console.log('wrote ic_launcher_background color');

// Splash screen: the app's own dark background with the icon centered small, replacing
// Capacitor's generic template splash for every density/orientation it scaffolded.
const SPLASH_TARGETS = [
  { dir: 'drawable', w: 480, h: 320 },
  { dir: 'drawable-land-mdpi', w: 480, h: 320 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480 },
  { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 },
];

for (const { dir, w, h } of SPLASH_TARGETS) {
  const outDir = path.join(RES_DIR, dir);
  mkdirSync(outDir, { recursive: true });
  const iconSize = Math.round(Math.min(w, h) * 0.35);
  const icon = await sharp(Buffer.from(foregroundSvg)).resize(iconSize, iconSize).png().toBuffer();
  await sharp({ create: { width: w, height: h, channels: 4, background: bg } })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toFile(path.join(outDir, 'splash.png'));
  console.log(`wrote ${dir}/splash.png`);
}
