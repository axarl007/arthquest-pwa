import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  startAdvertisingAndDiscovery, disconnect, sendBytes, onConnected, onDisconnected, onReceived, onError,
} from './nearbySync.js';
import { useForegroundVisible } from './useForegroundVisible.js';
import { buildPing, buildPong, parseNearbyMessage } from '../domain/pingProtocol.js';

/** Maps a raw plugin-rejection message to user-facing copy — "requiresPermission" and Capacitor's
 * own "not implemented on web" (this app's PWA build has no native NearbySync — Android-only,
 * see #18) both need friendlier text than the raw string reaching the screen. */
function friendlyErrorMessage(message) {
  if (message === 'requiresPermission') return 'Bluetooth/nearby-device permission is needed to sync.';
  if (typeof message === 'string' && message.includes('not implemented')) return "Syncing needs the Android app — it isn't available here.";
  return message;
}

/**
 * Manages the Nearby Connections session lifecycle (ticket #18) for the whole app: starts
 * advertising/discovering whenever this device is paired and the app is foregrounded, tears down
 * on backgrounding/unpairing/unmount, and answers pings with pongs so the connection can be
 * verified end to end (no real merge/sync protocol exists yet — that's #20).
 *
 * Call this once, at the top of the app (App.jsx) — it owns the plugin's singleton listener
 * subscriptions and native session, so a second call site would double-subscribe and
 * double-start it.
 */
export function useNearbySync() {
  const { state } = useStore();
  const [status, setStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const [remoteName, setRemoteName] = useState(null);
  const [error, setError] = useState(null);
  const [lastRoundTripMs, setLastRoundTripMs] = useState(null);
  const visible = useForegroundVisible();
  const pendingPingRef = useRef(null); // { nonce, startedAt } | null

  const pairedDeviceId = state.pairedDevice?.id ?? null;
  const pairedDeviceName = state.pairedDevice?.name ?? null;

  useEffect(() => {
    if (!pairedDeviceId || !state.deviceId || !visible) {
      setStatus('idle');
      return undefined;
    }
    let cancelled = false;
    setStatus('connecting');
    setError(null);
    setLastRoundTripMs(null); // stale from a previous session — this one hasn't sent a ping yet
    pendingPingRef.current = null;

    // Each addListener call's promise gets an immediate no-op .catch() (in addition to the real
    // cleanup handling below) — on a platform without a native NearbySync implementation (e.g.
    // this app's own web/PWA build), the promise rejects right away with "not implemented on
    // web", and attaching the cleanup's .catch() only at unmount time is too late to stop that
    // from surfacing as an unhandled promise rejection.
    const connectedSub = onConnected(() => {
      if (cancelled) return;
      // The native side only ever reports allowedRemoteId (i.e. pairedDeviceId) back as the
      // connected peer's id — there's exactly one paired device (ticket #17), so this is always
      // pairedDeviceName, never a lookup against some other value.
      setStatus('connected');
      setRemoteName(pairedDeviceName);
      setError(null); // clear anything left over from before this (re)connection
    });
    connectedSub.catch(() => {});
    const disconnectedSub = onDisconnected(() => {
      if (cancelled) return;
      setStatus('connecting');
      setRemoteName(null);
      setError(null);
    });
    disconnectedSub.catch(() => {});
    const errorSub = onError((message) => {
      if (cancelled) return;
      setError(friendlyErrorMessage(message));
      // A failed send (e.g. a dropped test ping — see NearbySyncManager.kt's sendPayload
      // failure listener) reaches this same generic event, but shouldn't hide an otherwise-live
      // connection: only downgrade status when there wasn't a connection to begin with.
      setStatus((prev) => (prev === 'connected' ? prev : 'error'));
    });
    errorSub.catch(() => {});
    const receivedSub = onReceived((bytes) => {
      if (cancelled) return;
      const message = parseNearbyMessage(new TextDecoder().decode(bytes));
      if (!message) return;
      if (message.type === 'ping') {
        sendBytes(new TextEncoder().encode(buildPong(message.nonce))).catch(() => {});
      } else if (message.type === 'pong' && pendingPingRef.current?.nonce === message.nonce) {
        setLastRoundTripMs(Date.now() - pendingPingRef.current.startedAt);
        pendingPingRef.current = null;
      }
    });
    receivedSub.catch(() => {});

    startAdvertisingAndDiscovery(state.deviceId, pairedDeviceId).catch((err) => {
      if (cancelled) return;
      setStatus('error');
      setError(friendlyErrorMessage(err?.message ?? String(err)));
    });

    return () => {
      cancelled = true;
      for (const sub of [connectedSub, disconnectedSub, errorSub, receivedSub]) {
        sub.then((handle) => handle.remove()).catch(() => {});
      }
      disconnect().catch(() => {});
    };
  }, [pairedDeviceId, pairedDeviceName, state.deviceId, visible]);

  const sendPing = () => {
    const nonce = crypto.randomUUID();
    pendingPingRef.current = { nonce, startedAt: Date.now() };
    setLastRoundTripMs(null);
    setError(null);
    sendBytes(new TextEncoder().encode(buildPing(nonce))).catch((err) => {
      setError(friendlyErrorMessage(err?.message ?? String(err)));
    });
  };

  return { status, remoteName, error, lastRoundTripMs, sendPing };
}
