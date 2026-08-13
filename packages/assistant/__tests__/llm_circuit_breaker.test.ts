import { LlmCircuitBreaker } from '../application/LlmCircuitBreaker';

describe('LlmCircuitBreaker', () => {
  it('stays closed while failures are below the threshold', () => {
    const breaker = new LlmCircuitBreaker(3, 60_000);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(false);
  });

  it('opens after reaching the failure threshold', () => {
    const breaker = new LlmCircuitBreaker(3, 60_000);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);
  });

  it('a single success resets the failure count and closes the breaker', () => {
    const breaker = new LlmCircuitBreaker(3, 60_000);
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordSuccess();
    breaker.recordFailure();
    breaker.recordFailure();
    // Only 2 consecutive failures since the reset — still below threshold of 3.
    expect(breaker.isOpen()).toBe(false);
  });

  it('closes automatically (half-open probe) once the cooldown elapses', () => {
    const breaker = new LlmCircuitBreaker(1, 10);
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(breaker.isOpen()).toBe(false);
        resolve();
      }, 20);
    });
  });

  it('reopens if the half-open probe also fails', () => {
    const breaker = new LlmCircuitBreaker(1, 10);
    breaker.recordFailure();
    expect(breaker.isOpen()).toBe(true);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(breaker.isOpen()).toBe(false); // probe allowed through
        breaker.recordFailure();
        expect(breaker.isOpen()).toBe(true); // reopened immediately (threshold=1)
        resolve();
      }, 20);
    });
  });

  it('exposes its current state for observability', () => {
    const breaker = new LlmCircuitBreaker(2, 60_000);
    breaker.recordFailure();
    const state = breaker.getState();
    expect(state.open).toBe(false);
    expect(state.consecutiveFailures).toBe(1);
    expect(state.openUntil).toBeNull();
  });
});
