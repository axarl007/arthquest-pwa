import { useTheme } from '../theme/useTheme.js';

/**
 * Shared pill-shaped segmented control — Settings' theme/icon-style pickers and Pairing's
 * My-code/Scan tabs all use the exact same active/inactive styling, so a visual tweak only needs
 * one edit instead of three.
 */
export function SegmentedControl({ options, value, onChange }) {
  const { T, C } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 8, background: T.card, borderRadius: 100, padding: 5 }}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1, padding: 9, borderRadius: 100, border: 'none',
              background: active ? C.accent : 'none', color: active ? T.onAccentText : T.textSecondary,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
