import { BACKOFF_DELAYS_MS, computeBackoffStep } from '../application/sync/reconnectPolicy';
import {
  areStructuredValuesEqual,
  getErrorMessage,
  isDuplicateRealtimeSnapshot,
  parseStateChangePayload,
} from '../application/sync/stateChangeMapping';

describe('reconnectPolicy', () => {
  it('keeps the 1s, 2s, 5s, 10s backoff sequence', () => {
    expect(BACKOFF_DELAYS_MS).toEqual([1000, 2000, 5000, 10000]);
  });

  it('advances through the sequence and saturates on the last delay', () => {
    expect(computeBackoffStep(0)).toEqual({ delayMs: 1000, nextRetryIndex: 1 });
    expect(computeBackoffStep(2)).toEqual({ delayMs: 5000, nextRetryIndex: 3 });
    expect(computeBackoffStep(3)).toEqual({ delayMs: 10000, nextRetryIndex: 3 });
    expect(computeBackoffStep(99)).toEqual({ delayMs: 10000, nextRetryIndex: 3 });
  });
});

describe('stateChangeMapping', () => {
  it('extracts a readable message from errors and non-errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom');
    expect(getErrorMessage('plain')).toBe('plain');
  });

  it('compares structured values ignoring key order', () => {
    expect(areStructuredValuesEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true);
    expect(areStructuredValuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(areStructuredValuesEqual([1, 2], [1])).toBe(false);
    expect(areStructuredValuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('detects duplicate realtime snapshots by state and attributes', () => {
    const known = { state: 'on', attributes: { brightness: 10 } };
    expect(isDuplicateRealtimeSnapshot(known, 'on', { brightness: 10 })).toBe(true);
    expect(isDuplicateRealtimeSnapshot(known, 'off', { brightness: 10 })).toBe(false);
    expect(isDuplicateRealtimeSnapshot(known, 'on', { brightness: 11 })).toBe(false);
    expect(isDuplicateRealtimeSnapshot(null, 'on', {})).toBe(false);
    expect(isDuplicateRealtimeSnapshot({ state: 'on' }, 'on', {})).toBe(true);
  });

  it('parses state_changed payloads and rejects malformed ones', () => {
    expect(parseStateChangePayload({
      entity_id: 'light.kitchen',
      new_state: { state: 'on', attributes: { brightness: 5 } },
    })).toEqual({ entityId: 'light.kitchen', newState: 'on', attributes: { brightness: 5 } });
    expect(parseStateChangePayload({ entity_id: 'light.kitchen', new_state: { state: 'on' } }))
      .toEqual({ entityId: 'light.kitchen', newState: 'on', attributes: {} });
    expect(parseStateChangePayload({ entity_id: 'light.kitchen', new_state: null })).toBeNull();
    expect(parseStateChangePayload({ entity_id: 1, new_state: {} })).toBeNull();
    expect(parseStateChangePayload(null)).toBeNull();
  });
});
