/**
 * One-time device pairing via QR code (ticket #17) — no Android app counterpart, since the
 * Android app never had multi-device sync. Identity exchange only: the QR each device shows
 * encodes its own stable `deviceId` (see store/persistence.js's ensureDeviceId) plus a
 * user-editable display name, so the scanning side learns a meaningful label ("Wife's Phone")
 * without having to type one in by hand. No data transport happens here — that's #18/#20.
 */
const PAIRING_PAYLOAD_VERSION = 1;

export function buildPairingPayload(deviceId, deviceName) {
  return JSON.stringify({ v: PAIRING_PAYLOAD_VERSION, id: deviceId, name: deviceName });
}

/**
 * Parses a scanned QR payload back into `{ id, name }`. Returns null for anything that isn't a
 * recognizable ArthQuest pairing code — a stranger's QR, a malformed scan, a future/older payload
 * version — so the caller can show one generic "not a pairing code" error rather than a raw parse
 * exception reaching the UI.
 */
export function parsePairingPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.v !== PAIRING_PAYLOAD_VERSION) return null;
  if (typeof parsed.id !== 'string' || !parsed.id) return null;
  if (typeof parsed.name !== 'string' || !parsed.name) return null;
  return { id: parsed.id, name: parsed.name };
}

/** A short, human-readable stand-in for a device's full UUID, shown next to its QR purely so two
 * people can visually sanity-check "yes, that's the code I see on my screen" — never used as an
 * input or lookup key itself. */
export function shortDeviceCode(deviceId) {
  const hex = deviceId.replace(/-/g, '').toUpperCase().slice(0, 8);
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * The `pairedDevice` to store after confirming a scan (ticket #22's "unpair-then-repair correctly
 * resets sync markers"). `lastSyncedAt` resets to null — forcing a fresh full sync on next
 * connect — for every case except one: re-confirming with the SAME device this one is already
 * paired to (id unchanged), where resetting it would just leave the Home indicator/nudge stuck on
 * a marker that can never repopulate itself (useNearbySync's connection effect keys on
 * id/name, so an unchanged id never fires a fresh 'connected' event to set it again — see
 * Pairing.jsx's original bug report). An explicit unpair always clears `pairedDevice` to null
 * first (see Pairing.jsx's `unpair`), so `currentPairedDevice` here is only ever non-null when the
 * user is re-confirming without having explicitly unpaired — a genuine unpair-then-repair (even
 * with the same device) always goes through the `null` branch below and correctly resets.
 */
export function nextPairedDevice(currentPairedDevice, scannedPeer, now = Date.now()) {
  const isSamePeerStillPaired = currentPairedDevice?.id === scannedPeer.id;
  return {
    id: scannedPeer.id,
    name: scannedPeer.name,
    pairedAt: now,
    lastSyncedAt: isSamePeerStillPaired ? currentPairedDevice.lastSyncedAt : null,
  };
}
