import { useTheme } from '../theme/useTheme.js';

/**
 * Page background + app frame. No fake OS chrome (status bar/bezel/gesture
 * nav) — the real device/browser supplies that. On installed/mobile widths
 * the frame runs edge-to-edge; on wide desktop viewports it becomes a
 * centered, rounded card so the phone-shaped layout doesn't stretch full
 * width. `env(safe-area-inset-*)` padding covers notches now that we own no
 * fake status bar to draw a gap for.
 */
export function AppShell({ children }) {
  const { T } = useTheme();

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: T.pageBg,
      }}
      className="app-page"
    >
      <div
        className="app-frame"
        style={{
          width: '100%',
          maxWidth: 460,
          minHeight: '100dvh',
          background: T.frameBg,
          color: T.text,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      >
        {children}
      </div>
    </div>
  );
}
