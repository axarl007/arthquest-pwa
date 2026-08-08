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
          // Bounds the frame to exactly the viewport so its flex:1/overflow:auto content
          // child (see App.jsx and every subscreen) actually scrolls internally instead of
          // the whole box growing past the viewport — without this, BottomNav/Fab (anchored
          // to the bottom of this box) end up pushed below the fold, requiring a page-level
          // scroll to reach them. Deliberately not `height` here: the desktop media query
          // (index.css, >=640px) sets its own non-!important `height`, which an inline
          // `height` would always win over regardless of the query; `maxHeight` is a
          // different property so it can't fight that override (and is a no-op there anyway,
          // since min(92vh, 900px) is already <= 100dvh).
          maxHeight: '100dvh',
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
