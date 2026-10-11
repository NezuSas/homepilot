/**
 * Mapeo y comparación puros de eventos state_changed de Home Assistant.
 */

export interface HomeAssistantStateChangePayload {
  entityId: string;
  newState: unknown;
  attributes: Record<string, unknown>;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function areStructuredValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length
      && left.every((value, index) => areStructuredValuesEqual(value, right[index]));
  }

  if (!isRecord(left) || !isRecord(right)) return false;

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key, index) => (
    key === rightKeys[index] && areStructuredValuesEqual(left[key], right[key])
  ));
}

export function isDuplicateRealtimeSnapshot(
  lastKnownState: Record<string, unknown> | null,
  state: string,
  attributes: Record<string, unknown>,
): boolean {
  return lastKnownState?.state === state
    && areStructuredValuesEqual(lastKnownState.attributes ?? {}, attributes);
}

export function parseStateChangePayload(data: unknown): HomeAssistantStateChangePayload | null {
  if (!isRecord(data) || typeof data.entity_id !== 'string' || !isRecord(data.new_state)) {
    return null;
  }

  const attributes = isRecord(data.new_state.attributes) ? data.new_state.attributes : {};

  return {
    entityId: data.entity_id,
    newState: data.new_state.state,
    attributes,
  };
}
