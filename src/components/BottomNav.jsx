import { useTheme } from '../theme/useTheme.js';

const NAV_DEFS = [
  { key: 'home', label: 'Home' },
  { key: 'transactions', label: 'Ledger' },
  { key: 'budget', label: 'Budget' },
  { key: 'quests', label: 'Quests' },
];

function NavIcon({ navKey, color }) {
  if (navKey === 'home') return <div style={{ width: 16, height: 16, borderRadius: 8, background: color }} />;
  if (navKey === 'transactions')
    return <div style={{ width: 16, height: 10, borderRadius: 3, border: `2px solid ${color}` }} />;
  if (navKey === 'budget')
    return (
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          background: `conic-gradient(${color} 0deg 200deg, transparent 200deg)`,
          border: `2px solid ${color}`,
        }}
      />
    );
  return <div style={{ width: 12, height: 12, background: color, transform: 'rotate(45deg)', borderRadius: 2 }} />;
}

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
              <NavIcon navKey={n.key} color={color} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
