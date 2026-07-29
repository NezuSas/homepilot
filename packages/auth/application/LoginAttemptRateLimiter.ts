export interface LoginAttemptRateLimiterOptions {
  maxFailures?: number;
  lockoutMs?: number;
  now?: () => number;
}

interface AttemptState {
  failures: number;
  lockedUntil: number | null;
}

/**
 * Local, in-memory protection against password guessing.
 *
 * A successful login clears the matching key immediately. Failed attempts lock
 * the username + client address pair for a bounded period, without revealing
 * whether an account exists.
 */
export class LoginAttemptRateLimiter {
  private readonly attempts = new Map<string, AttemptState>();
  private readonly maxFailures: number;
  private readonly lockoutMs: number;
  private readonly now: () => number;

  constructor(options: LoginAttemptRateLimiterOptions = {}) {
    this.maxFailures = options.maxFailures ?? this.readPositiveInteger('HOMEPILOT_AUTH_MAX_FAILURES', 5);
    this.lockoutMs = options.lockoutMs ?? this.readPositiveInteger('HOMEPILOT_AUTH_LOCKOUT_MS', 15 * 60 * 1000);
    this.now = options.now ?? (() => Date.now());
  }

  public getRetryAfterSeconds(key: string): number | null {
    const state = this.attempts.get(key);
    if (!state?.lockedUntil) return null;

    const remaining = state.lockedUntil - this.now();
    if (remaining <= 0) {
      this.attempts.delete(key);
      return null;
    }

    return Math.ceil(remaining / 1000);
  }

  public registerFailure(key: string): number | null {
    const state = this.attempts.get(key) ?? { failures: 0, lockedUntil: null };
    state.failures += 1;

    if (state.failures >= this.maxFailures) {
      state.failures = 0;
      state.lockedUntil = this.now() + this.lockoutMs;
      this.attempts.set(key, state);
      return Math.ceil(this.lockoutMs / 1000);
    }

    this.attempts.set(key, state);
    return null;
  }

  public registerSuccess(key: string): void {
    this.attempts.delete(key);
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const value = Number.parseInt(process.env[name] ?? '', 10);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
  }
}
