import { useStore } from '../../store/useStore.js';
import { useTheme } from '../../theme/useTheme.js';
import { formatINR } from '../../domain/format.js';
import { BottomSheet } from './BottomSheet.jsx';

export function TxActionsSheet({ txId, name, amount, type, onClose }) {
  const { setState } = useStore();
  const { T } = useTheme();

  const deleteTx = () => {
    setState((s) => ({ transactions: s.transactions.filter((t) => t.id !== txId) }));
    onClose();
  };

  const sign = type === 'income' ? '+' : '-';

  return (
    <BottomSheet onClose={onClose} maxHeight="auto">
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{name}</div>
      <div style={{ fontSize: 13, color: T.textTertiary, marginTop: 2 }}>{sign}{formatINR(amount)}</div>
      <button
        type="button"
        onClick={deleteTx}
        style={{ width: '100%', padding: 14, borderRadius: 100, border: 'none', background: 'oklch(0.3 0.08 25)', color: 'oklch(0.85 0.1 25)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}
      >
        Delete transaction
      </button>
      <button
        type="button"
        onClick={onClose}
        style={{ width: '100%', padding: 14, borderRadius: 100, border: `1px solid ${T.border}`, background: 'none', color: T.textSecondary, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 10 }}
      >
        Cancel
      </button>
    </BottomSheet>
  );
}
