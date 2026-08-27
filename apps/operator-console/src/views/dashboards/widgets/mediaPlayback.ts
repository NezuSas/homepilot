import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

export interface MediaPresentation {
  state: string;
  mediaTitle: string | null;
  mediaArtist: string | null;
  volume: number | null;
  mediaPosition: number | null;
  mediaDuration: number | null;
  mediaPositionUpdatedAt: string | null;
}

export interface MediaPositionReference {
  readonly position: number;
  readonly referenceAt: number;
}

export interface MediaPlaybackReference extends MediaPositionReference {
  readonly sourceKey: string;
}

export function shouldResyncMediaPlaybackReference(
  currentReference: MediaPlaybackReference | null,
  sourceKey: string,
  reportedPosition: number,
  thresholdSeconds: number,
): boolean {
  return currentReference === null
    || currentReference.sourceKey !== sourceKey
    || Math.abs(reportedPosition - currentReference.position) >= thresholdSeconds;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstText(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function normalizedState(value: string | null): string {
  return value?.trim().toLocaleLowerCase() || 'idle';
}

function numericVolume(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value * 100)));
}

function numericSeconds(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return value;
}

export function getMediaPlayerPresentation(device?: SnapshotDevice, isPreview = false): MediaPresentation {
  if (!device && isPreview) {
    return {
      state: 'paused',
      mediaTitle: null,
      mediaArtist: null,
      volume: 50,
      mediaPosition: null,
      mediaDuration: null,
      mediaPositionUpdatedAt: null,
    };
  }

  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  return {
    state: normalizedState(firstText([state.state, state.value, attributes.state])),
    mediaTitle: firstText([state.media_title, attributes.media_title, state.title, attributes.title]),
    mediaArtist: firstText([state.media_artist, attributes.media_artist, state.media_album_artist, attributes.media_album_artist]),
    volume: numericVolume(state.volume_level ?? attributes.volume_level),
    mediaPosition: numericSeconds(state.media_position ?? attributes.media_position),
    mediaDuration: numericSeconds(state.media_duration ?? attributes.media_duration),
    mediaPositionUpdatedAt: firstText([state.media_position_updated_at, attributes.media_position_updated_at]),
  };
}

export function formatMediaTime(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const secondsText = String(seconds).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secondsText}`
    : `${minutes}:${secondsText}`;
}

export function getDisplayedMediaPosition(
  presentation: MediaPresentation,
  now = Date.now(),
  positionReference: MediaPositionReference | null = null,
): number | null {
  if (presentation.mediaPosition === null || presentation.mediaDuration === null) return null;

  const reportedUpdatedAt = presentation.mediaPositionUpdatedAt ? Date.parse(presentation.mediaPositionUpdatedAt) : Number.NaN;
  const referenceAt = positionReference?.referenceAt ?? (Number.isFinite(reportedUpdatedAt) ? reportedUpdatedAt : null);
  const position = positionReference?.position ?? presentation.mediaPosition;
  const elapsedSeconds = presentation.state === 'playing' && referenceAt !== null && Number.isFinite(referenceAt)
    ? Math.max(0, (now - referenceAt) / 1000)
    : 0;
  return Math.min(presentation.mediaDuration, position + elapsedSeconds);
}