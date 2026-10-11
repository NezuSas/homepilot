/**
 * Qualifiers the deterministic assistant cannot honor. Running the command and
 * silently dropping the qualifier would do something different from what was
 * asked, so these phrases are answered instead of executed.
 */

const COMMAND_VERB = /^(?:enciende|prende|apaga|abre|cierra|activa|desactiva|pon|turn|switch|open|close|set)\b/u;
// "en 5 segundos", "dentro de 10 segundos", "in 30 seconds", "after 5 seconds".
const SECONDS_DELAY = /\b(?:en|dentro de|despues de|in|after|within)\s+\d+\s*(?:segundos?|segs?|seconds?|secs?)\b/u;

/** True when a device command asks for a delay measured in seconds, which timers do not support. */
export function asksForSecondsDelay(normalized: string): boolean {
  return COMMAND_VERB.test(normalized) && SECONDS_DELAY.test(normalized);
}
