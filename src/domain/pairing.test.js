import { describe, it, expect } from 'vitest';
import { buildPairingPayload, parsePairingPayload, shortDeviceCode, nextPairedDevice } from './pairing.js';

describe('buildPairingPayload / parsePairingPayload round-trip', () => {
  it('round-trips a device id and name', () => {
    const payload = buildPairingPayload('device-1', "Axar's Phone");
    expect(parsePairingPayload(payload)).toEqual({ id: 'device-1', name: "Axar's Phone" });
  });
});

describe('parsePairingPayload', () => {
  it('returns null for a QR that is not JSON at all (some stranger\'s QR code)', () => {
    expect(parsePairingPayload('https://example.com/not-a-pairing-code')).toBeNull();
  });

  it('returns null for JSON missing the expected shape', () => {
    expect(parsePairingPayload(JSON.stringify({ hello: 'world' }))).toBeNull();
  });

  it('returns null for a mismatched payload version', () => {
    expect(parsePairingPayload(JSON.stringify({ v: 2, id: 'x', name: 'y' }))).toBeNull();
  });

  it('returns null when id or name is missing or not a non-empty string', () => {
    expect(parsePairingPayload(JSON.stringify({ v: 1, id: '', name: 'y' }))).toBeNull();
    expect(parsePairingPayload(JSON.stringify({ v: 1, id: 'x', name: '' }))).toBeNull();
    expect(parsePairingPayload(JSON.stringify({ v: 1, id: 123, name: 'y' }))).toBeNull();
    expect(parsePairingPayload(JSON.stringify({ v: 1, name: 'y' }))).toBeNull();
  });

  it('returns null for null/non-object JSON', () => {
    expect(parsePairingPayload('null')).toBeNull();
    expect(parsePairingPayload('42')).toBeNull();
    expect(parsePairingPayload('"a string"')).toBeNull();
  });
});

describe('shortDeviceCode', () => {
  it('derives an 8-char, dash-grouped, uppercase code from a UUID', () => {
    expect(shortDeviceCode('a1b2c3d4-e5f6-47a8-9012-345678901234')).toBe('A1B2-C3D4');
  });

  it('is deterministic for the same id', () => {
    const id = 'f0f0f0f0-1111-2222-3333-444455556666';
    expect(shortDeviceCode(id)).toBe(shortDeviceCode(id));
  });
});

describe('nextPairedDevice', () => {
  it('starts lastSyncedAt at null for a first-ever pairing (was never paired before)', () => {
    const result = nextPairedDevice(null, { id: 'device-2', name: "Wife's Phone" }, 5000);
    expect(result).toEqual({ id: 'device-2', name: "Wife's Phone", pairedAt: 5000, lastSyncedAt: null });
  });

  it('resets lastSyncedAt to null when re-pairing with a DIFFERENT device (a genuine switch)', () => {
    const current = { id: 'device-2', name: "Wife's Phone", pairedAt: 1000, lastSyncedAt: 4000 };
    const result = nextPairedDevice(current, { id: 'device-3', name: "Kid's Tablet" }, 5000);
    expect(result).toEqual({ id: 'device-3', name: "Kid's Tablet", pairedAt: 5000, lastSyncedAt: null });
  });

  it('resets lastSyncedAt to null after an explicit unpair, even re-pairing with the SAME device (currentPairedDevice is null post-unpair)', () => {
    // Mirrors Pairing.jsx's unpair() clearing pairedDevice to null before any re-pair can happen —
    // this is the actual "unpair-then-repair" acceptance scenario (ticket #22), distinct from
    // merely re-scanning a still-current partner's code below.
    const result = nextPairedDevice(null, { id: 'device-2', name: "Wife's Phone" }, 9000);
    expect(result.lastSyncedAt).toBeNull();
  });

  it('carries lastSyncedAt forward when re-confirming the SAME device without ever unpairing (avoids a marker that can never repopulate)', () => {
    const current = { id: 'device-2', name: "Wife's Phone", pairedAt: 1000, lastSyncedAt: 4000 };
    const result = nextPairedDevice(current, { id: 'device-2', name: "Wife's Phone" }, 5000);
    expect(result).toEqual({ id: 'device-2', name: "Wife's Phone", pairedAt: 5000, lastSyncedAt: 4000 });
  });

  it('always refreshes pairedAt to now, even on a same-device re-confirm', () => {
    const current = { id: 'device-2', name: 'Old Name', pairedAt: 1000, lastSyncedAt: 4000 };
    const result = nextPairedDevice(current, { id: 'device-2', name: 'New Name' }, 9000);
    expect(result.pairedAt).toBe(9000);
    expect(result.name).toBe('New Name');
  });
});
