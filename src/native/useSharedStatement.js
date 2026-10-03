import { useEffect, useRef } from 'react';
import { StatementShare } from './statementShare.js';

/**
 * Calls `onShare({ base64?, error? })` for a statement file shared into the app (ticket #40; raw
 * bytes as base64 since #45, so a PDF survives the bridge) —
 * cold launch via getPendingShare(), warm launch via the 'shared' event — mirroring
 * useAppShortcutDeepLink's cold/warm split and ref-held handler. An inert no-op on the PWA build,
 * where the plugin has no web implementation (both calls reject and are swallowed).
 */
export function useSharedStatement(onShare) {
  const onShareRef = useRef(onShare);
  onShareRef.current = onShare;

  useEffect(() => {
    const deliver = (result) => {
      if (result && (result.base64 || result.error)) onShareRef.current(result);
    };
    // Deliberately not dropped after cleanup: the native side hands the cold-start share out
    // exactly once, so under StrictMode's mount-unmount-mount the *first* call is the one holding
    // it. The caller (App) is never truly unmounted, so delivering late is always safe.
    StatementShare.getPendingShare().then(deliver).catch(() => {});
    const listenerPromise = StatementShare.addListener('shared', deliver);
    listenerPromise.catch(() => {});
    return () => {
      listenerPromise.then((listener) => listener.remove()).catch(() => {});
    };
  }, []);
}
