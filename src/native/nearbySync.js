import { registerPlugin } from '@capacitor/core';
import { bytesToBase64, base64ToBytes } from '../domain/bytesCodec.js';

/**
 * Capacitor bridge for ticket #18's native transport (Android-only — see
 * android/app/src/main/java/com/arthquest/pwa/NearbySyncPlugin.kt for the native implementation).
 * Advertises and discovers simultaneously via Play Services' Nearby Connections API, accepting a
 * connection only from the one device paired in ticket #17. No merge/sync semantics live here —
 * raw byte transport only; the sync-wiring ticket (#20) builds the real protocol on top of this
 * without touching native code again.
 *
 * Native methods:
 *   startAdvertisingAndDiscovery({ localId, allowedRemoteId }): Promise<void>
 *     Requests Bluetooth/Wi-Fi/location permissions if not already granted (rejects with
 *     "requiresPermission" if declined), then starts advertising as `localId` and discovering
 *     `allowedRemoteId`, connecting automatically once both are in range with both apps open.
 *   disconnect(): Promise<void> — tears down any active/pending connection and stops
 *     advertising/discovery.
 *   send({ data: string }): Promise<void> — `data` is base64; rejects if nothing is connected.
 *   openAppSettings(): Promise<void> — opens this app's system settings screen (ticket #22), for
 *     a "permission denied/revoked" error's "Open Settings" action.
 *
 * Native events: 'connected' -> { remoteId }, 'disconnected' -> {}, 'received' -> { data: base64
 * string }, 'error' -> { message }.
 *
 * This module wraps that raw base64 surface with a bytes-level API to match, since callers
 * shouldn't need to think about the JS<->native bridge's base64 encoding.
 */
export const NearbySync = registerPlugin('NearbySync');

export function startAdvertisingAndDiscovery(localId, allowedRemoteId) {
  return NearbySync.startAdvertisingAndDiscovery({ localId, allowedRemoteId });
}

export function disconnect() {
  return NearbySync.disconnect();
}

export function sendBytes(bytes) {
  return NearbySync.send({ data: bytesToBase64(bytes) });
}

export function onConnected(callback) {
  return NearbySync.addListener('connected', ({ remoteId }) => callback(remoteId));
}

export function onDisconnected(callback) {
  return NearbySync.addListener('disconnected', () => callback());
}

export function onReceived(callback) {
  return NearbySync.addListener('received', ({ data }) => callback(base64ToBytes(data)));
}

export function onError(callback) {
  return NearbySync.addListener('error', ({ message }) => callback(message));
}

export function openAppSettings() {
  return NearbySync.openAppSettings();
}
