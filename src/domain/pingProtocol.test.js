import { describe, it, expect } from 'vitest';
import { buildPing, buildPong, parseNearbyMessage } from './pingProtocol.js';

describe('buildPing / buildPong / parseNearbyMessage', () => {
  it('parses a built ping back to its type and nonce', () => {
    expect(parseNearbyMessage(buildPing('abc123'))).toEqual({ type: 'ping', nonce: 'abc123' });
  });

  it('parses a built pong back to its type and nonce', () => {
    expect(parseNearbyMessage(buildPong('abc123'))).toEqual({ type: 'pong', nonce: 'abc123' });
  });

  it('returns null for text that is not JSON at all', () => {
    expect(parseNearbyMessage('not json')).toBeNull();
  });

  it('returns null for JSON with an unrecognized type', () => {
    expect(parseNearbyMessage(JSON.stringify({ type: 'hello', nonce: 'x' }))).toBeNull();
  });

  it('returns null when nonce is missing or not a string', () => {
    expect(parseNearbyMessage(JSON.stringify({ type: 'ping' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'ping', nonce: 42 }))).toBeNull();
  });

  it('returns null for null/non-object JSON', () => {
    expect(parseNearbyMessage('null')).toBeNull();
    expect(parseNearbyMessage('"a string"')).toBeNull();
  });
});
