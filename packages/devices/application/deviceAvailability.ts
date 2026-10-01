export const HOME_ASSISTANT_ENTITY_MISSING_REASON = 'entity_missing';
export const UNAVAILABLE_INBOX_RETENTION_MS = 24 * 60 * 60 * 1000;
export const INBOX_OBSERVATION_INTERVAL_MS = 15 * 60 * 1000;

/** Track only observations from a successful source read, not transport outages. */
export function trackInboxAvailability(
  previousState: Record<string, unknown> | null,
  nextState: Record<string, unknown>,
  now: number,
): Record<string, unknown> {
  const state = { ...nextState };
  delete state.homepilotUnavailableSince;
  delete state.homepilotUnavailableCheckedAt;
  if (state.state !== 'unavailable' && state.state !== 'offline') return state;
  const since = typeof previousState?.homepilotUnavailableSince === 'number' ? previousState.homepilotUnavailableSince : NaN;
  const checkedAt = typeof previousState?.homepilotUnavailableCheckedAt === 'number' ? previousState.homepilotUnavailableCheckedAt : NaN;
  const continuous = Number.isFinite(since) && since <= checkedAt && checkedAt <= now
    && now - checkedAt <= 2 * INBOX_OBSERVATION_INTERVAL_MS;
  return { ...state, homepilotUnavailableSince: continuous ? since : now, homepilotUnavailableCheckedAt: now };
}

export function hasExpiredInboxAvailability(state: Record<string, unknown>, now: number): boolean {
  return (state.state === 'unavailable' || state.state === 'offline')
    && typeof state.homepilotUnavailableSince === 'number'
    && typeof state.homepilotUnavailableCheckedAt === 'number'
    && state.homepilotUnavailableCheckedAt <= now
    && now - state.homepilotUnavailableCheckedAt <= INBOX_OBSERVATION_INTERVAL_MS
    && now - state.homepilotUnavailableSince > UNAVAILABLE_INBOX_RETENTION_MS;
}

export function buildUnavailableDeviceState(
  previousState: Record<string, unknown> | null,
): Record<string, unknown> {
  return {
    ...(previousState ?? {}),
    state: 'unavailable',
    availabilityReason: HOME_ASSISTANT_ENTITY_MISSING_REASON,
  };
}
