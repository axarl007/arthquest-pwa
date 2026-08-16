import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { isQuickAddDeepLink } from '../domain/deepLinks.js';

/**
 * Fires `onQuickAdd` when the home-screen widget's "+" tap target (ticket #32) launches the app —
 * covers both a warm launch (app already running, `appUrlOpen` fires) and a cold launch (app was
 * closed, so the triggering URL is only available via `getLaunchUrl()` once on mount, not as an
 * `appUrlOpen` event).
 *
 * `onQuickAdd` is read from a ref so this doesn't need to re-subscribe whenever the caller's
 * closure changes — same rationale as `useAndroidBackButton`'s `latestRef`.
 *
 * `@capacitor/app`'s web implementation has no `appUrlOpen`/real `getLaunchUrl()` (see
 * AppWeb in its source), so this is an inert no-op on the PWA build.
 */
export function useQuickAddDeepLink(onQuickAdd) {
  const onQuickAddRef = useRef(onQuickAdd);
  onQuickAddRef.current = onQuickAdd;

  useEffect(() => {
    let cancelled = false;

    CapacitorApp.getLaunchUrl().then((launch) => {
      if (!cancelled && isQuickAddDeepLink(launch?.url)) onQuickAddRef.current();
    });

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      if (isQuickAddDeepLink(url)) onQuickAddRef.current();
    });

    return () => {
      cancelled = true;
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);
}
