import { useTheme } from '../theme/useTheme.js';
import { monthLabel } from '../domain/format.js';

/**
 * Persistent month-navigation control ("‹ July 2026 ›"), shared by Home, Transactions, and Budget
 * per the design spec. Extracted from Budget.jsx's original inline chevrons, which were missing
 * flex-centering on the button (the character sat per default text layout instead of dead-center
 * in the circle) — built correctly here from the start, matching SubscreenHeader's back-button
 * pattern, so every screen using this gets centered chevrons for free.
 */
export function MonthSelector({ monthKey, onPrev, onNext }) {
  const { T } = useTheme();
  const chevronStyle = {
    width: 30,
    height: 30,
    borderRadius: 15,
    border: 'none',
    background: T.btnSecondaryBg,
    color: T.text,
    fontSize: 15,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 4 }}>
      <button type="button" onClick={onPrev} aria-label="Previous month" style={chevronStyle}>
        ‹
      </button>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text }}>{monthLabel(monthKey)}</span>
      <button type="button" onClick={onNext} aria-label="Next month" style={chevronStyle}>
        ›
      </button>
    </div>
  );
}
