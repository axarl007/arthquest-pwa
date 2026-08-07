import { useTheme } from '../theme/useTheme.js';

/**
 * Main-screen title bar (Home/Ledger/Budget/Quests) with an optional
 * right-side icon button — matches the spec's isMainScreen header block.
 * `action` is { icon, onClick, variant }; variant 'quest' tints the button
 * purple (used for the Quests "new quest" action), everything else uses the
 * neutral secondary button background.
 */
export function ScreenHeader({ title, action }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 20px 2px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 29, fontWeight: 800, color: T.text }}>
        {title}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          aria-label={action.label}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            border: 'none',
            background: action.variant === 'quest' ? 'oklch(0.3 0.07 300)' : T.btnSecondaryBg,
            color: action.variant === 'quest' ? 'oklch(0.85 0.1 300)' : T.text,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          {action.icon === 'menu' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ width: 16, height: 2, borderRadius: 1, background: T.textSecondary }} />
              <div style={{ width: 11, height: 2, borderRadius: 1, background: T.textSecondary }} />
              <div style={{ width: 16, height: 2, borderRadius: 1, background: T.textSecondary }} />
            </div>
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
              {action.icon}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

/** Back-button header for subscreens (Quest detail, Categories, Settings, Category detail). */
export function SubscreenHeader({ title, onBack }) {
  const { T } = useTheme();
  return (
    <div style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 22px) 20px 2px', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            border: 'none',
            background: T.btnSecondaryBg,
            color: T.text,
            fontSize: 18,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          ←
        </button>
        <div
          style={{
            fontFamily: "'Baloo 2', sans-serif",
            fontSize: 21,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: T.text,
          }}
        >
          {title}
        </div>
      </div>
    </div>
  );
}
