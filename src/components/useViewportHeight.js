import { useLayoutEffect, useRef } from 'react';

const PROPERTY = '--app-vh';

function setAppVhProperty() {
  document.documentElement.style.setProperty(PROPERTY, `${window.innerHeight}px`);
}

/**
 * Keeps the --app-vh custom property in sync with the real layout-viewport
 * height, as a replacement for relying on 100dvh's own recompute.
 *
 * Why: on Android Chrome, 100dvh doesn't always recompute correctly after
 * some viewport-changing events mid-session — e.g. the address-bar
 * show/hide animation triggered by the native pull-to-refresh gesture —
 * even though a fresh cold start computes it correctly. That leaves
 * .app-frame taller than the visible viewport, pushing BottomNav/Fab below
 * the fold until the app is fully reloaded. Reading window.innerHeight
 * (the layout viewport) on every resize and writing it to a CSS custom
 * property sidesteps the browser's own dvh recompute bug entirely.
 *
 * Deliberately window.innerHeight, not window.visualViewport.height: the
 * latter also shrinks when the on-screen keyboard opens, which would make
 * .app-frame visibly resize under every text input on this screen — a new
 * behavior change, not part of this fix. window.innerHeight tracks the
 * layout viewport (what dvh is meant to track, and what actually changes
 * during address-bar show/hide), and Android Chrome does not shrink it for
 * the keyboard — matching dvh's existing keyboard-agnostic behavior.
 *
 * Writes directly to document.documentElement's inline style rather than
 * React state: resize can fire repeatedly during a single address-bar
 * animation, and funneling that through React state would re-render the
 * whole AppShell subtree (the entire app) on every frame. This is a single
 * imperative DOM mutation per event instead, with no React commit.
 *
 * useLayoutEffect (not useEffect): sets the real value before the browser
 * paints the first frame, so there's no visible snap from the `100dvh`
 * fallback to the JS-computed value on mount.
 */
export function useViewportHeight() {
  const rafIdRef = useRef(null);

  useLayoutEffect(() => {
    // Batches to one write per animation frame — an address-bar show/hide animation (the
    // exact scenario this hook exists for) can dispatch several resize events in quick
    // succession, and each raw call would force a synchronous layout recalc of the whole tree.
    // Scoped to this ref (not module state) so cleanup can reliably reset it to null on
    // unmount — a shared module-level id left stale after a cancelled frame would permanently
    // block every future scheduling check, silently freezing --app-vh.
    const scheduleSetAppVhProperty = () => {
      if (rafIdRef.current !== null) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setAppVhProperty();
      });
    };

    setAppVhProperty();
    window.addEventListener('resize', scheduleSetAppVhProperty);
    window.addEventListener('orientationchange', scheduleSetAppVhProperty);
    return () => {
      window.removeEventListener('resize', scheduleSetAppVhProperty);
      window.removeEventListener('orientationchange', scheduleSetAppVhProperty);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);
}
