/**
 * The application-level message convention layered over the Nearby Connections raw-byte transport
 * (ticket #18) — the native plugin only ever moves bytes, it has no idea what a "ping" or a "sync
 * state" is. Two message kinds share this one wire format so a single `parseNearbyMessage` at the
 * receiving end can tell them apart:
 *   - ping/pong: lets a human verify two paired devices actually exchange data end to end (send a
 *     ping, the other side echoes a pong) — a raw-transport connectivity check, independent of
 *     any app data.
 *   - state: the real sync payload (ticket #20) — a device's full transactions/categories/
 *     incomeCategories/budgetAllocations, exchanged automatically once a connection is
 *     established and merged via `domain/sync.js`'s `mergeState`/`applyIncomingSync`.
 */
export function buildPing(nonce) {
  return JSON.stringify({ type: 'ping', nonce });
}

export function buildPong(nonce) {
  return JSON.stringify({ type: 'pong', nonce });
}

/**
 * `payload` is whatever `domain/sync.js`'s `syncPayload(state)` produced — this module doesn't
 * know or care about its shape beyond "an object", leaving validation to the merge layer.
 *
 * `senderId` is the sending device's own stable `deviceId` (ticket #17), not derived from the
 * transport: the native 'received' event carries only raw bytes, with no sender identity of its
 * own, and Capacitor's addListener can leave an old session's listener briefly still registered
 * while a new one is being set up (e.g. re-pairing to a different device while still connected to
 * the old one) — see useNearbySync.js's check against the currently-paired device id before
 * applying a 'state' message, which only works because the sender stamps its own id here.
 */
export function buildStateMessage(payload, senderId) {
  return JSON.stringify({ type: 'state', payload, senderId });
}

/** A well-formed sync record: a non-null object with a real string `id` — the minimum every
 * record in `payload.transactions`/`categories`/`incomeCategories`/`budgetAllocations` must have
 * for `mergeState`'s `unionById` to key on it safely. Doesn't validate every field of every
 * record type (matching this codebase's existing validation depth — parseBackupJson doesn't
 * either), just enough to stop a bare number/string/id-less object from silently colliding with
 * other records under the same `undefined` Map key and corrupting local state. */
function isRecordArray(arr) {
  return Array.isArray(arr) && arr.every((item) => item != null && typeof item === 'object' && typeof item.id === 'string' && item.id.length > 0);
}

/** Parses a received message back into `{ type: 'ping'|'pong', nonce }` or `{ type: 'state',
 * payload, senderId }`, or null for anything that isn't a recognizable message of this protocol. */
export function parseNearbyMessage(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (parsed.type === 'ping' || parsed.type === 'pong') {
    if (typeof parsed.nonce !== 'string' || !parsed.nonce) return null;
    return { type: parsed.type, nonce: parsed.nonce };
  }
  if (parsed.type === 'state') {
    const p = parsed.payload;
    if (!p || typeof p !== 'object') return null;
    if (typeof parsed.senderId !== 'string' || !parsed.senderId) return null;
    // Every field mergeState's unionById iterates must actually be an array of well-formed,
    // id-bearing records — a malformed, version-skewed, or truncated-but-still-valid-JSON
    // payload with a missing/wrong-shaped key would otherwise reach `for (const item of
    // remoteItems)` inside the merge reducer and throw (crashing the whole app on the receiving
    // device — there's no ErrorBoundary anywhere in this tree), or worse, silently succeed with
    // id-less records colliding under the same Map key and corrupting local state. Rejected here
    // instead, the same way every other data-shape boundary in this app tolerates bad input
    // rather than crashing on it (see persistence.js's loadState, parseBackupJson).
    if (!isRecordArray(p.transactions) || !isRecordArray(p.categories) || !isRecordArray(p.incomeCategories) || !isRecordArray(p.budgetAllocations)) return null;
    return { type: 'state', payload: p, senderId: parsed.senderId };
  }
  return null;
}
