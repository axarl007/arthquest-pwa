import { useTheme } from '../theme/useTheme.js';

/**
 * Shared "not built yet" body used by the ticket #1 shell screens before
 * onboarding (#2), the ledger (#3), budget (#4), and quests (#5) land.
 * Superseded screen-by-screen as those tickets ship.
 */
export function EmptyStateBody({ title, body }) {
  const { T } = useTheme();
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 32px',
        gap: 6,
      }}
    >
      <div style={{ fontFamily: "'Baloo 2', sans-serif", fontSize: 17, fontWeight: 700, color: T.text }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: T.textTertiary, lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
