import { useTheme } from '../theme/useTheme.js';

// Material Symbols icon names, not hand-drawn CSS shapes — a prior version drew each tab as its
// own one-off div (filled circle, outlined rectangle, gradient ring, rotated square), which mixed
// solid and outlined treatments of inconsistent visual weight and read as "unbalanced" even
// though each icon was itself precisely centered (verified by measuring actual DOM coordinates).
// 'flag' matches the icon already used everywhere else in the app for Quests (see
// NewQuestSheet.jsx, which mirrors Android's QuestFormSheet.kt fixed 'flag' icon), not a new
// one-off choice.
const NAV_DEFS = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'transactions', label: 'Ledger', icon: 'receipt_long' },
  { key: 'budget', label: 'Budget', icon: 'pie_chart' },
  { key: 'quests', label: 'Quests', icon: 'flag' },
];

export function BottomNav({ active, onNavigate }) {
  const { T, C } = useTheme();
  return (
    <div
      style={{
        flexShrink: 0,
        padding: '8px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', gap: 4, background: T.card, border: T.cardBorder, borderRadius: 100, padding: 6 }}>
        {NAV_DEFS.map((n) => {
          const isActive = active === n.key;
          const color = isActive ? C.accent : T.textTertiary;
          return (
            <button
              key={n.key}
              type="button"
              onClick={() => onNavigate(n.key)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                padding: '8px 14px',
                borderRadius: 100,
                border: 'none',
                background: isActive ? 'oklch(0.3 0.06 245)' : 'transparent',
                cursor: 'pointer',
              }}
            >
              {/* aria-hidden: a Material Symbols glyph is a real text character (a ligature, e.g.
                  the literal string "home"), not an image — without this it gets read into the
                  button's accessible name alongside the visible label below, turning "Home" into
                  "homeHome" for screen readers (and breaking any `getByRole('button', {name})`
                  query, which is exactly how this regression was caught). The visible label
                  already fully conveys what this button does, so the icon is purely decorative. */}
              <span className="material-symbols-outlined" aria-hidden="true" style={{ fontSize: 22, color }}>
                {n.icon}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
