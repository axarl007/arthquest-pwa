import { useTheme } from '../../theme/useTheme.js';

/**
 * Shared backdrop + slide-up sheet shell used by every modal sheet in the app (log transaction,
 * transaction actions, new quest, redeem, add category, etc.) — matches the design spec's common
 * sheet styling exactly so each concrete sheet only needs to supply its content.
 */
export function BottomSheet({ onClose, maxHeight, children }) {
  const { T } = useTheme();
  return (
    <>
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 20, animation: 'fadeIn 0.15s' }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: maxHeight ?? '88%',
          background: T.sheetBg,
          borderRadius: '24px 24px 0 0',
          padding: '14px 20px calc(env(safe-area-inset-bottom, 0px) + 22px)',
          zIndex: 21,
          animation: 'sheetUp 0.2s ease-out',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border, alignSelf: 'center', marginBottom: 14 }} />
        {children}
      </div>
    </>
  );
}
