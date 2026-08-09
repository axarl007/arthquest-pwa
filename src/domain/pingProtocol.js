/**
 * A tiny application-level message convention layered over the Nearby Connections raw-byte
 * transport (ticket #18) — the native plugin only ever moves bytes, it has no idea what a "ping"
 * is. This is purely so a human can verify two paired devices actually exchange data end to end
 * (send a ping, the other side echoes a pong) before any real merge/sync protocol exists (#20).
 */
export function buildPing(nonce) {
  return JSON.stringify({ type: 'ping', nonce });
}

export function buildPong(nonce) {
  return JSON.stringify({ type: 'pong', nonce });
}

/** Parses a received message back into `{ type: 'ping'|'pong', nonce }`, or null for anything
 * that isn't a recognizable message of this protocol. */
export function parseNearbyMessage(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.type !== 'ping' && parsed.type !== 'pong') return null;
  if (typeof parsed.nonce !== 'string' || !parsed.nonce) return null;
  return { type: parsed.type, nonce: parsed.nonce };
}
