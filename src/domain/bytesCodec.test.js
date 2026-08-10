import { describe, it, expect } from 'vitest';
import { bytesToBase64, base64ToBytes } from './bytesCodec.js';

describe('bytesToBase64 / base64ToBytes round-trip', () => {
  it('round-trips arbitrary byte values, including 0 and 255', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255, 42]);
    const decoded = base64ToBytes(bytesToBase64(bytes));
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it('round-trips a UTF-8 encoded JSON payload (the shape a real sync message would take)', () => {
    const text = JSON.stringify({ hello: 'world', amount: 4200 });
    const bytes = new TextEncoder().encode(text);
    const decoded = base64ToBytes(bytesToBase64(bytes));
    expect(new TextDecoder().decode(decoded)).toBe(text);
  });

  it('round-trips an empty array', () => {
    expect(Array.from(base64ToBytes(bytesToBase64(new Uint8Array())))).toEqual([]);
  });
});
