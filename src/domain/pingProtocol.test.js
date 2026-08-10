import { describe, it, expect } from 'vitest';
import { buildPing, buildPong, buildStateMessage, parseNearbyMessage } from './pingProtocol.js';

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

  it('parses a built state message back to its type, payload, and senderId', () => {
    const payload = { transactions: [], categories: [], incomeCategories: [], budgetAllocations: [] };
    expect(parseNearbyMessage(buildStateMessage(payload, 'device-a'))).toEqual({ type: 'state', payload, senderId: 'device-a' });
  });

  it('returns null for a state message with a missing or non-object payload', () => {
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', senderId: 'device-a' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: 'nope', senderId: 'device-a' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: null, senderId: 'device-a' }))).toBeNull();
  });

  it('returns null for a state message with a missing or non-string senderId', () => {
    const payload = { transactions: [], categories: [], incomeCategories: [], budgetAllocations: [] };
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload, senderId: '' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload, senderId: 42 }))).toBeNull();
  });

  it('returns null for a state message with a missing or wrong-shaped field (a malformed/version-skewed peer payload must not reach the merge reducer)', () => {
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: {}, senderId: 'device-a' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({
      type: 'state',
      payload: { transactions: [], categories: [], incomeCategories: [], budgetAllocations: 'not-an-array' },
      senderId: 'device-a',
    }))).toBeNull();
  });

  it('returns null for a state message whose arrays contain non-object or id-less entries (would otherwise collide under an undefined Map key and corrupt local state)', () => {
    const base = { categories: [], incomeCategories: [], budgetAllocations: [] };
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: { ...base, transactions: [42, 'oops'] }, senderId: 'device-a' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: { ...base, transactions: [{ amount: 100 }] }, senderId: 'device-a' }))).toBeNull();
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload: { ...base, transactions: [null] }, senderId: 'device-a' }))).toBeNull();
  });

  it('accepts a state message whose arrays contain well-formed, id-bearing records', () => {
    const payload = { transactions: [{ id: 't1' }], categories: [{ id: 'c1' }], incomeCategories: [], budgetAllocations: [] };
    expect(parseNearbyMessage(JSON.stringify({ type: 'state', payload, senderId: 'device-a' }))).toEqual({ type: 'state', payload, senderId: 'device-a' });
  });
});
