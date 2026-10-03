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
 * Wires the Android hardware back button and gesture-nav edge swipe (ticket #29) to the same
 * close/back handlers each subscreen's own on-screen back control already uses, via
 * resolveBackTarget's priority order. Both the physical/on-screen back button and a gesture-nav
 * swipe funnel through the same androidx OnBackPressedDispatcher `@capacitor/app` registers with
 * (AppPlugin.java's `getOnBackPressedDispatcher().addCallback(...)`), so this works for either
 * input method without needing to distinguish them.
 *
 * The manifest explicitly sets `android:enableOnBackInvokedCallback="false"`, opting OUT of
 * Android 13+'s predictive-back preview animation. The shipped v1.0.3 build set this to `"true"`
 * expecting that to enable the preview animation on top of otherwise-normal dispatch — but this
 * app targets API 36 (android/variables.gradle), and Android 16+ already *defaults* the flag to
 * true for API-36-targeting apps, so `"true"` was a no-op and merely reproduced whatever
 * predictive-back-on-by-default already does on-device. That produced a real-device regression
 * (gesture stopped doing anything at all — reported and diagnosed same day). Explicit `"false"` is
 * the only value that actually forces legacy dispatch on this targetSdk; leaving the attribute
 * unset (the seemingly obvious "just don't opt in" fix) would have been just as much a no-op as
 * `"true"` was, for the same reason.
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
