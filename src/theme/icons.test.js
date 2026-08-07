import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { iconFor, iconBoxBg, iconSize, iconImgUrl, EMOJI_MAP, ICON_OPTIONS } from './icons.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('iconFor', () => {
  it('returns the Material Symbols name for flat style', () => {
    expect(iconFor('home', 'flat')).toBe('home');
  });
  it('returns the emoji for cartoon style', () => {
    expect(iconFor('home', 'cartoon')).toBe('🏠');
  });
  it('falls back to a label tag emoji for unknown icons in cartoon style', () => {
    expect(iconFor('totally_unknown_icon', 'cartoon')).toBe('🏷️');
  });
});

describe('iconBoxBg', () => {
  it('uses the category color for flat style', () => {
    expect(iconBoxBg('oklch(0.62 0.13 245)', 'flat')).toBe('oklch(0.62 0.13 245)');
  });
  it('is transparent for cartoon style', () => {
    expect(iconBoxBg('oklch(0.62 0.13 245)', 'cartoon')).toBe('transparent');
  });
});

describe('iconSize', () => {
  it('scales up more for cartoon than flat', () => {
    expect(iconSize(16, 'flat')).toBe('18px');
    expect(iconSize(16, 'cartoon')).toBe('19px');
  });
});

describe('iconImgUrl', () => {
  it('returns null for flat style', () => {
    expect(iconImgUrl('home', 'flat')).toBeNull();
  });
  it('returns a local (non-CDN) svg path for cartoon style', () => {
    const url = iconImgUrl('home', 'cartoon');
    expect(url).toBe('/icons/twemoji/home.svg');
    expect(url).not.toMatch(/^https?:/);
  });
});

describe('bundled Twemoji assets', () => {
  it('has a local svg file for every EMOJI_MAP entry, matching iconImgUrl paths', () => {
    const publicDir = path.resolve(__dirname, '../../public');
    for (const name of Object.keys(EMOJI_MAP)) {
      const url = iconImgUrl(name, 'cartoon');
      const filePath = path.join(publicDir, url);
      expect(existsSync(filePath), `missing ${filePath} for icon "${name}"`).toBe(true);
    }
  });

  it('has an emoji mapping (directly or via fallback) for every category-icon option', () => {
    for (const name of ICON_OPTIONS) {
      expect(iconFor(name, 'cartoon')).toBeTruthy();
    }
  });
});
