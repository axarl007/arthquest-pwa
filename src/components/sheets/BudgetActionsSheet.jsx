import { useTheme } from '../../theme/useTheme.js';
import { BottomSheet } from './BottomSheet.jsx';

export function BudgetActionsSheet({ onClose, onAddCategory, onAdjustIncomeSplit }) {
  const { T } = useTheme();
  const actionButtonStyle = {
    width: '100%', textAlign: 'left', padding: '14px 16px', borderRadius: 14,
    border: 'none', background: T.card, color: T.text, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  };
  return (
    <BottomSheet onClose={onClose}>
      <button type="button" onClick={onAddCategory} style={actionButtonStyle}>
        + Add category
      </button>
      <button type="button" onClick={onAdjustIncomeSplit} style={{ ...actionButtonStyle, marginTop: 8 }}>
        Adjust income split
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{
          width: '100%', padding: 14, borderRadius: 100, border: `1px solid ${T.border}`,
          background: 'none', color: T.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 14,
        }}
      >
        Cancel
      </button>
    </BottomSheet>
  );
}
