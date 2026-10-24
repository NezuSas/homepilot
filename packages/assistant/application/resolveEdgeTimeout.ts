/**
 * Reads a timeout from an environment value, never below the floor the caller needs.
 *
 * A missing or unparseable value falls back to that floor rather than to zero, so a typo in the
 * environment cannot leave a speech request with no time to complete. The speech-to-text and
 * text-to-speech services each had an identical private copy, with their own floor as the only
 * difference — which they still pass in.
 */
export function resolveEdgeTimeout(value: string | undefined, minimumMs: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? Math.max(parsed, minimumMs) : minimumMs;
}
