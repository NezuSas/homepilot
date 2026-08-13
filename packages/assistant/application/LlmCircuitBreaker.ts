/**
 * LlmCircuitBreaker
 *
 * Stops calling a struggling/unreachable Ollama instance after a run of
 * consecutive failures, instead of paying the full request timeout on every
 * single conversational turn during an outage. Without this, a down Ollama
 * adds its entire timeout (e.g. 3.5s on the live execution path) to *every*
 * turn that reaches the semantic pass — exactly the "don't leave the user
 * waiting" failure mode the local-first architecture is meant to avoid.
 *
 * Half-open recovery: once the cooldown elapses, the very next call is let
 * through as a probe. If it fails again, the breaker reopens for another
 * cooldown; if it succeeds, the breaker fully resets.
 */
export class LlmCircuitBreaker {
  private consecutiveFailures = 0;
  private openUntil: number | null = null;

  constructor(
    private readonly failureThreshold: number = 3,
    private readonly cooldownMs: number = 60_000
  ) {}

  /**
   * Whether calls should currently be skipped. Automatically closes (and
   * allows a single probe through) once the cooldown window has elapsed.
   */
  public isOpen(): boolean {
    if (this.openUntil === null) return false;
    if (Date.now() >= this.openUntil) {
      this.openUntil = null;
      this.consecutiveFailures = 0;
      return false;
    }
    return true;
  }

  public recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.openUntil = null;
  }

  public recordFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.failureThreshold && this.openUntil === null) {
      this.openUntil = Date.now() + this.cooldownMs;
      console.warn(`[PLANNER_V2_CIRCUIT_OPEN] ${JSON.stringify({
        consecutiveFailures: this.consecutiveFailures,
        cooldownMs: this.cooldownMs
      })}`);
    }
  }

  public getState(): { open: boolean; consecutiveFailures: number; openUntil: number | null } {
    return {
      open: this.isOpen(),
      consecutiveFailures: this.consecutiveFailures,
      openUntil: this.openUntil
    };
  }
}
