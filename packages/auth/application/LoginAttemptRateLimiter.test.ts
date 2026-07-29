import { LoginAttemptRateLimiter } from './LoginAttemptRateLimiter';

describe('LoginAttemptRateLimiter', () => {
  it('locks a key after the configured number of failed attempts and releases it when time elapses', () => {
    let now = 1_000;
    const limiter = new LoginAttemptRateLimiter({ maxFailures: 3, lockoutMs: 10_000, now: () => now });

    expect(limiter.registerFailure('owner|127.0.0.1')).toBeNull();
    expect(limiter.registerFailure('owner|127.0.0.1')).toBeNull();
    expect(limiter.registerFailure('owner|127.0.0.1')).toBe(10);
    expect(limiter.getRetryAfterSeconds('owner|127.0.0.1')).toBe(10);

    now += 10_001;
    expect(limiter.getRetryAfterSeconds('owner|127.0.0.1')).toBeNull();
  });

  it('clears failed attempts after a successful login', () => {
    const limiter = new LoginAttemptRateLimiter({ maxFailures: 2 });
    limiter.registerFailure('owner|127.0.0.1');
    limiter.registerSuccess('owner|127.0.0.1');

    expect(limiter.registerFailure('owner|127.0.0.1')).toBeNull();
  });
});
