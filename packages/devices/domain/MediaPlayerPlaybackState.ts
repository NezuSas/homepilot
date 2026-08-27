const PLAYBACK_RESYNC_THRESHOLD_SECONDS = 2;

interface PlaybackReference {
  readonly sourceKey: string;
  readonly position: number;
  readonly referenceAt: string;
  readonly nativePosition: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(values: readonly unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function numericSeconds(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function mediaSourceKey(state: Record<string, unknown>, attributes: Record<string, unknown>): string | null {
  const contentId = firstText([attributes.media_content_id, state.media_content_id]);
  const title = firstText([attributes.media_title, state.media_title, attributes.title, state.title]);
  const artist = firstText([attributes.media_artist, state.media_artist, attributes.media_album_artist, state.media_album_artist]);
  const duration = numericSeconds(attributes.media_duration ?? state.media_duration);
  if (contentId === null && title === null) return null;

  return [contentId ?? '', title ?? '', artist ?? '', duration === null ? '' : String(duration)].join('\u0000');
}

function playbackReference(attributes: Record<string, unknown>): PlaybackReference | null {
  const sourceKey = typeof attributes.homepilot_media_source_key === 'string'
    ? attributes.homepilot_media_source_key
    : null;
  const position = numericSeconds(attributes.homepilot_media_position);
  const referenceAt = typeof attributes.homepilot_media_position_updated_at === 'string'
    ? attributes.homepilot_media_position_updated_at
    : null;
  const nativePosition = numericSeconds(attributes.homepilot_native_media_position);

  return sourceKey !== null && position !== null && referenceAt !== null && nativePosition !== null
    ? { sourceKey, position, referenceAt, nativePosition }
    : null;
}

/**
 * Preserves a server-side media clock when an integration republishes a
 * stationary position with a new timestamp. Raw media attributes remain
 * available, while HomePilot-specific attributes provide a stable reference
 * shared by every browser session.
 */
export function normalizeMediaPlaybackState(
  previousState: Record<string, unknown> | null,
  incomingState: Record<string, unknown>,
  observedAt: string,
): Record<string, unknown> {
  const attributes = asRecord(incomingState.attributes);
  const state = firstText([incomingState.state, incomingState.value, attributes.state])?.toLocaleLowerCase();
  const position = numericSeconds(incomingState.media_position ?? attributes.media_position);
  const duration = numericSeconds(incomingState.media_duration ?? attributes.media_duration);
  const sourceKey = mediaSourceKey(incomingState, attributes);

  if (state !== 'playing' || position === null || duration === null || sourceKey === null) {
    return incomingState;
  }

  const previousReference = playbackReference(asRecord(previousState?.attributes));
  const shouldResync = previousReference === null
    || previousReference.sourceKey !== sourceKey
    || Math.abs(position - previousReference.nativePosition) >= PLAYBACK_RESYNC_THRESHOLD_SECONDS;
  const reference = shouldResync
    ? { sourceKey, position, referenceAt: observedAt, nativePosition: position }
    : { ...previousReference, nativePosition: position };

  return {
    ...incomingState,
    attributes: {
      ...attributes,
      homepilot_media_source_key: reference.sourceKey,
      homepilot_media_position: reference.position,
      homepilot_media_position_updated_at: reference.referenceAt,
      homepilot_native_media_position: reference.nativePosition,
    },
  };
}