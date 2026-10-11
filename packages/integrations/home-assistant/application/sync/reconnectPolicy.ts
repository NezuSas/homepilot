/**
 * Política de reconexión con backoff para el WebSocket de Home Assistant.
 */

/** Secuencia de backoff en milisegundos: 1s → 2s → 5s → 10s (fijo). */
export const BACKOFF_DELAYS_MS: readonly number[] = [1000, 2000, 5000, 10000];

export interface BackoffStep {
  /** Espera antes del siguiente reintento. */
  delayMs: number;
  /** Índice a usar en el reintento posterior. */
  nextRetryIndex: number;
}

/** Devuelve la espera para `retryIndex` y el índice siguiente, saturando en el último valor. */
export function computeBackoffStep(retryIndex: number): BackoffStep {
  const lastIndex = BACKOFF_DELAYS_MS.length - 1;
  return {
    delayMs: BACKOFF_DELAYS_MS[Math.min(retryIndex, lastIndex)],
    nextRetryIndex: Math.min(retryIndex + 1, lastIndex),
  };
}
