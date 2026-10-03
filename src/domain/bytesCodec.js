/**
 * Base64 <-> byte array conversion for the Nearby Connections transport (ticket #18). Capacitor
 * plugin calls/events are JSON, which can't carry raw binary, so bytes cross the JS<->native
 * bridge as base64 strings — this is the codec both directions share.
 */
export function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
