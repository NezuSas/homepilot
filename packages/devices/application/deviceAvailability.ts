export const HOME_ASSISTANT_ENTITY_MISSING_REASON = 'entity_missing';

export function buildUnavailableDeviceState(
  previousState: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...(previousState ?? {}),
    state: 'unavailable',
    availabilityReason: HOME_ASSISTANT_ENTITY_MISSING_REASON,
  };
}
