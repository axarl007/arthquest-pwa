import { useEffect } from 'react';
import { useTheme } from '../theme/useTheme.js';

export const IMPORT_UNDO_MS = 10000;

/**
 * Post-import "Imported N · Undo" toast (ticket #38). Auto-dismisses after IMPORT_UNDO_MS; there's
 * no persisted batch history, so once it's gone the batch can only be removed row by row. Sits
 * above the Fab (bottom 86 + 56px tall) so it never covers the primary action.
 */
export function ImportUndoToast({ count, onUndo, onDismiss }) {
  const { T, C } = useTheme();
  useEffect(() => {
    const timer = setTimeout(onDismiss, IMPORT_UNDO_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      style={{
        position: 'absolute', left: 16, right: 16, bottom: 'calc(env(safe-area-inset-bottom, 0px) + 154px)', zIndex: 16,
        display: 'flex', alignItems: 'center', gap: 12, background: T.sheetBg, border: T.cardBorder, borderRadius: 14,
        padding: '12px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', animation: 'popIn 0.2s',
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 18, color: C.safe }}>check_circle</span>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: T.text }}>
        Imported {count} transaction{count === 1 ? '' : 's'}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{ background: 'none', border: 'none', color: C.accent, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', padding: '4px 6px' }}
      >
        Undo
      </button>
    </div>
  );
}
