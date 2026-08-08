import { iconFor, iconBoxBg, iconImgUrl, iconSize } from '../theme/icons.js';

/**
 * The icon-box rendering shared by every place a category/quest/income-source icon appears
 * (onboarding rows, the transaction category picker, the transaction list, and — in later
 * tickets — Budget, Quests, Categories). `color` is the box tint in "flat" icon style; callers
 * are responsible for picking the right color per the design spec's own rules, which vary by
 * context (a category's own persisted `color` in most places, but a fixed accent for income
 * transaction rows and a fixed gold for quest redemptions — see Transactions.jsx/
 * LogTransactionSheet.jsx for the exact mapping).
 *
 * `bare`, when true, skips the outer box (background/radius) and renders only the glyph/image —
 * for callers that already supply their own box, like AddCategorySheet's icon-picker buttons,
 * whose background encodes selection state rather than the icon-box tint convention `color`/
 * `iconBoxBg` follow everywhere else.
 */
export function CategoryIcon({ icon, color, iconStyle, size, radius, glyphBase, bare = false }) {
  const imgUrl = iconImgUrl(icon, iconStyle);
  const glyphSize = iconSize(glyphBase, iconStyle);
  const glyph = imgUrl ? (
    <div style={{ width: glyphSize, height: glyphSize, backgroundImage: `url(${imgUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
  ) : (
    <span className="material-symbols-outlined" style={{ fontSize: glyphSize, color: bare ? 'inherit' : 'oklch(0.15 0.02 265)' }}>
      {iconFor(icon, iconStyle)}
    </span>
  );

  if (bare) return glyph;

  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius ?? size * 0.3, background: iconBoxBg(color, iconStyle),
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {glyph}
    </div>
  );
}
