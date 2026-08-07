// Minimal OKLCH -> sRGB hex converter (Bjorn Ottosson's formulas), used to
// keep generated icon artwork colorimetrically identical to the in-app
// oklch() design tokens rather than eyeballed hex approximations.
function srgbGamma(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

export function oklchToHex(L, C, H) {
  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const r = srgbGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = srgbGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const bl = srgbGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);

  const toHex = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}

const OKLCH_RE = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Parses a plain `oklch(L C H)` CSS string (as used by src/theme/tokens.js) to hex. */
export function tokenToHex(oklchString) {
  const m = OKLCH_RE.exec(oklchString.trim());
  if (!m) throw new Error(`Not a plain oklch(L C H) string: ${oklchString}`);
  return oklchToHex(Number(m[1]), Number(m[2]), Number(m[3]));
}
