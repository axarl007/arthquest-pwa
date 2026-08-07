// Copies the subset of Twemoji SVGs used by the "cartoon" icon style (per the
// canonical EMOJI_MAP in src/theme/icons.js) into public/icons/twemoji/<name>.svg,
// keyed by icon name (not codepoint) so runtime resolution is a plain string
// template, no codepoint math needed.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { EMOJI_MAP } from '../src/theme/icons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '../node_modules/@discordapp/twemoji/dist/svg');
const OUT_DIR = path.join(__dirname, '../public/icons/twemoji');

function codepoints(emoji) {
  return Array.from(emoji)
    .map((ch) => ch.codePointAt(0).toString(16))
    .filter((cp) => cp !== 'fe0f')
    .join('-');
}

mkdirSync(OUT_DIR, { recursive: true });

let missing = [];
for (const [name, emoji] of Object.entries(EMOJI_MAP)) {
  const cp = codepoints(emoji);
  const src = path.join(SRC_DIR, `${cp}.svg`);
  const dest = path.join(OUT_DIR, `${name}.svg`);
  if (!existsSync(src)) {
    missing.push(`${name} (${emoji} -> ${cp})`);
    continue;
  }
  copyFileSync(src, dest);
}

if (missing.length) {
  console.error('Missing Twemoji source SVGs for:', missing.join(', '));
  process.exit(1);
}
console.log(`Copied ${Object.keys(EMOJI_MAP).length} Twemoji SVGs to ${OUT_DIR}`);
