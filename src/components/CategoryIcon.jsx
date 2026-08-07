import { iconFor, iconBoxBg, iconImgUrl, iconSize } from '../theme/icons.js';

/**
 * The icon-box rendering shared by every place a category/quest/income-source icon appears
 * (onboarding rows, the transaction category picker, the transaction list, and — in later
 * tickets — Budget, Quests, Categories). `color` is the box tint in "flat" icon style; callers
 * are responsible for picking the right color per the design spec's own rules, which vary by
 * context (a category's own persisted `color` in most places, but a fixed accent for income
 * transaction rows and a fixed gold for quest redemptions — see Transactions.jsx/
 * LogTransactionSheet.jsx for the exact mapping).
 */
export function CategoryIcon({ icon, color, iconStyle, size, radius, glyphBase }) {
  const bg = iconBoxBg(color, iconStyle);
  const imgUrl = iconImgUrl(icon, iconStyle);
  const glyphSize = iconSize(glyphBase, iconStyle);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: radius ?? size * 0.3, background: bg,
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {imgUrl ? (
        <div style={{ width: glyphSize, height: glyphSize, backgroundImage: `url(${imgUrl})`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' }} />
      ) : (
        <span className="material-symbols-outlined" style={{ fontSize: glyphSize, color: 'oklch(0.15 0.02 265)' }}>
          {iconFor(icon, iconStyle)}
        </span>
      )}
    </div>
  );
}
