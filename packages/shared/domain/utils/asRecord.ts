/**
 * Reads an unknown value as a plain object, or as an empty one when it is not.
 *
 * Device state arrives from integrations as free-form JSON, so every reader has to narrow it before
 * looking at a field. Four places had their own identical copy of this coercion — a route, two assistant
 * modules and a domain model — which is how the same payload ends up interpreted differently in each.
 *
 * An array is excluded on purpose: it is an object, but indexing it by a field name yields nothing
 * useful, so treating it as absent is the honest reading.
 */
export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
