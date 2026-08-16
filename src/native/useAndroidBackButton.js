import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { resolveBackTarget } from '../domain/backNavigation.js';

const HANDLER_KEY = {
  sheet: 'onCloseSheet',
  categoryDetail: 'onCloseCategoryDetail',
  questDetail: 'onCloseQuestDetail',
  settings: 'onCloseSettings',
  home: 'onGoHome',
};

/**
 * Wires the Android hardware back button and predictive-back gesture (ticket #29) to the same
 * close/back handlers each subscreen's own on-screen back control already uses, via
 * resolveBackTarget's priority order.
 *
 * The listener is registered once, in an empty-deps effect — re-registering on every render would
 * race the async `listener.remove()` from the previous render's cleanup (addListener/remove both
 * resolve async), leaving two 'backButton' listeners live for a moment and double-firing a single
 * back-press. Latest navState/handlers are read from a ref instead (same pattern as
 * useNearbySync.js's `stateRef`), so the listener's closure never goes stale.
 *
 * `@capacitor/app`'s web implementation never emits 'backButton' (only its native Android/iOS
 * implementations do), so this is an inert no-op on the PWA build.
 */
export function useAndroidBackButton(navState, handlers) {
  const latestRef = useRef({ navState, handlers });
  latestRef.current = { navState, handlers };

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('backButton', () => {
      const { navState: currentNavState, handlers: currentHandlers } = latestRef.current;
      const target = resolveBackTarget(currentNavState);
      if (target === 'exit') {
        CapacitorApp.exitApp();
        return;
      }
      currentHandlers[HANDLER_KEY[target]]();
    });
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, []);
}
