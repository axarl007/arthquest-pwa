import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { deepLinkAction } from '../domain/deepLinks.js';

/**
 * Fires the matching handler when a recognized deep link (ticket #33's widget, ticket #34's
 * native launcher-icon app shortcuts) launches the app — covers both a warm launch (app already
 * running, `appUrlOpen` fires) and a cold launch (app was closed, so the triggering URL is only
 * available via `getLaunchUrl()` once on mount, not as an `appUrlOpen` event).
 *
 * `handlers` is `{ 'add-transaction': fn, 'add-category': fn, 'new-quest': fn }` — one shared
 * `appUrlOpen`/`getLaunchUrl()` subscription dispatching to whichever handler matches, rather than
 * each caller registering its own listener (which would risk the same launch/open event being
 * handled more than once). Read from a ref so this doesn't need to re-subscribe whenever the
 * caller's handlers change — same rationale as `useAndroidBackButton`'s `latestRef`.
 *
 * `@capacitor/app`'s web implementation has no `appUrlOpen`/real `getLaunchUrl()` (see AppWeb in
 * its source), so this is an inert no-op on the PWA build.
 */
export function useAppShortcutDeepLink(handlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let cancelled = false;

    const dispatch = (url) => {
      const action = deepLinkAction(url);
      if (action && !cancelled) handlersRef.current[action]?.();
    };

    CapacitorApp.getLaunchUrl().then((launch) => dispatch(launch?.url));
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => dispatch(url));

    return () => {
      cancelled = true;
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);
}
