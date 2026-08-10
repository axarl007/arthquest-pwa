import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore.js';
import {
  startAdvertisingAndDiscovery, disconnect, sendBytes, onConnected, onDisconnected, onReceived, onError, openAppSettings,
} from './nearbySync.js';
import { useForegroundVisible } from './useForegroundVisible.js';
import { buildPing, buildPong, buildStateMessage, parseNearbyMessage } from '../domain/pingProtocol.js';
import { syncPayload, applyIncomingSync } from '../domain/sync.js';

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
 * on backgrounding/unpairing/unmount, answers pings with pongs so raw connectivity can be verified
 * end to end, and (ticket #20) automatically exchanges + merges each device's data the moment a
 * connection is established — see domain/sync.js for the merge logic itself.
 *
 * Call this once, at the top of the app (App.jsx) — it owns the plugin's singleton listener
 * subscriptions and native session, so a second call site would double-subscribe and
 * double-start it.
 */
export function useNearbySync() {
  const { state, setState } = useStore();
  const [status, setStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const [remoteName, setRemoteName] = useState(null);
  const [error, setError] = useState(null);
  const [lastRoundTripMs, setLastRoundTripMs] = useState(null);
  // True specifically when the "nearby" permission is the reason sync isn't working — denied the
  // first time, or revoked later via Android's own Settings (ticket #22) — as opposed to any
  // other connection error, so Pairing.jsx can show a distinct, actionable "Open Settings"
  // explainer instead of just the generic error line other failures get.
  const [permissionDenied, setPermissionDenied] = useState(false);
  const visible = useForegroundVisible();
  const pendingPingRef = useRef(null); // { nonce, startedAt } | null
  // Always-current `state`, read (never written) from the async connection-lifecycle callbacks
  // below — those callbacks are created once per effect run and would otherwise close over
  // whatever `state` was at that moment, sending a stale snapshot if the user edited data
  // between pairing and the peer actually coming into range. The *write* side (applying an
  // incoming sync) doesn't need this: it uses setState's updater form, which always sees the
  // latest committed state regardless of when the callback was created.
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Encodes and sends this device's current data as a sync 'state' message (ticket #20) — shared
  // by the automatic on-connect send below and the manual `sync()` re-trigger, so the wire
  // encoding only needs to change in one place. Known v1 limitation, called out explicitly by
  // ticket #20 itself ("full state exchange is acceptable for v1 given expected data volume,
  // note if this needs revisiting later"): this sends the *entire* history every time, as one
  // Nearby Connections BYTES payload — Android's docs describe BYTES as meant for small
  // immediate-delivery messages, not an unbounded amount of data, so a very long-lived account
  // could in principle need FILE/STREAM payloads or a real diff protocol instead of this. Not
  // reproducible without physical hardware and years of accumulated data, so left as documented
  // debt rather than guessed at.
  const sendCurrentState = (onFailure) => {
    const message = buildStateMessage(syncPayload(stateRef.current), stateRef.current.deviceId);
    sendBytes(new TextEncoder().encode(message)).catch(onFailure);
  };

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
    setPermissionDenied(false); // a fresh attempt — cleared until this attempt proves otherwise
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
      setPermissionDenied(false); // a live connection proves the permission is fine
      // Sync (ticket #20): send this device's current data the moment a connection is
      // established. The peer does the same on its own 'connected' event, so both sides
      // converge without any host/client negotiation — see the module doc comment on
      // domain/sync.js for why mergeState is safe to run from either direction. Most send
      // failures (e.g. sendPayload actually failing on the wire) do surface later via the
      // 'error' event handled below, not through this promise — but a handleOnPause() torn down
      // the native session in the brief window before this reaches it rejects synchronously
      // with no matching 'error' event, so this specific send is silently missed rather than
      // reported. Not fixed: the connection is already gone in that case (the app backgrounded),
      // and the visibility-driven effect below re-connects and re-sends on the next foreground,
      // so this self-heals rather than leaving sync permanently stuck.
      sendCurrentState(() => {});
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
      } else if (message.type === 'state') {
        // The merge+persist step (ticket #20): setState's updater form always runs against the
        // latest committed state, not whatever `state` this closure captured or this effect
        // instance was started with — deliberately so, since Capacitor's addListener can leave a
        // stale session's listener briefly still registered after re-pairing to a different
        // device while still connected to the old one. applyIncomingSync itself re-checks
        // `message.senderId` against *that* latest state's actual paired device (not this
        // closure's possibly-stale `pairedDeviceId`) before merging anything in — see its own doc
        // comment for why the check has to live there to actually close the race. lastSyncedAt
        // only advances on a real merge — never merely on 'connected' — so a transfer that never
        // arrives leaves it untouched.
        setState((s) => applyIncomingSync(s, message.payload, message.senderId));
      }
    });
    receivedSub.catch(() => {});

    startAdvertisingAndDiscovery(state.deviceId, pairedDeviceId).catch((err) => {
      if (cancelled) return;
      // The permission request/denial round-trip resolves through THIS call's own promise (see
      // NearbySyncPlugin.kt's startAdvertisingAndDiscovery -> requestPermissionForAlias ->
      // onPermissionResult, which rejects the original PluginCall), not through the 'error' event
      // below — so this is the one place "requiresPermission" is actually seen, whether the user
      // just declined the prompt or had previously granted, then revoked, the permission via
      // Android's own Settings app.
      const rawMessage = err?.message ?? String(err);
      if (rawMessage === 'requiresPermission') setPermissionDenied(true);
      setStatus('error');
      setError(friendlyErrorMessage(rawMessage));
    });

    return () => {
      cancelled = true;
      for (const sub of [connectedSub, disconnectedSub, errorSub, receivedSub]) {
        sub.then((handle) => handle.remove()).catch(() => {});
      }
      disconnect().catch(() => {});
    };
  }, [pairedDeviceId, pairedDeviceName, state.deviceId, visible, setState]);

  const sendPing = () => {
    const nonce = crypto.randomUUID();
    pendingPingRef.current = { nonce, startedAt: Date.now() };
    setLastRoundTripMs(null);
    setError(null);
    sendBytes(new TextEncoder().encode(buildPing(nonce))).catch((err) => {
      setError(friendlyErrorMessage(err?.message ?? String(err)));
    });
  };

  // Re-sends this device's current data on an already-open connection — the automatic send in
  // onConnected above only fires once, when the connection is first established, so this is the
  // way to push new local edits made *after* that (both apps left open and connected) without a
  // full disconnect/reconnect cycle. Safe to call as often as wanted: mergeState is idempotent,
  // so the peer applying the same data twice is a no-op (ticket #19/#20's own requirement).
  const sync = () => {
    setError(null);
    sendCurrentState((err) => setError(friendlyErrorMessage(err?.message ?? String(err))));
  };

  // Opens this app's own system settings screen (ticket #22) — the actionable next step for
  // `permissionDenied`, rather than leaving the user stuck on an error with no path forward.
  const openSettings = () => {
    openAppSettings().catch((err) => setError(friendlyErrorMessage(err?.message ?? String(err))));
  };

  return { status, remoteName, error, lastRoundTripMs, sendPing, sync, permissionDenied, openAppSettings: openSettings };
}
