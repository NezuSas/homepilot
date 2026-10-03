import { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { API_BASE_URL } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { getMediaArtworkSourceKey } from './mediaArtwork';
import { getDisplayedMediaPosition, getMediaPlayerPresentation, hasActiveMediaSession, isMediaPlaybackReference, shouldResyncMediaPlaybackReference, type MediaPlaybackReference } from './mediaPlayback';

export type MediaPlayerCommand = 'turn_on' | 'turn_off' | 'media_play' | 'media_pause' | 'media_previous_track' | 'media_next_track' | 'volume_set';
export const MEDIA_VOLUME_STEP = 10;

const PLAYBACK_RESYNC_THRESHOLD_SECONDS = 2;
const PLAYBACK_REFERENCE_STORAGE_PREFIX = 'homepilot.media-playback-reference.';

interface MediaArtworkSession {
  readonly artworkPath: string | null;
}

function supportedCommands(device?: SnapshotDevice): ReadonlySet<string> {
  const commands = new Set<string>();
  device?.profile?.supportedCommands.forEach((command) => commands.add(command));
  device?.capabilities?.forEach((capability) => capability.commands?.forEach((command) => commands.add(command.name)));
  return commands;
}

function isUnavailable(state: string) {
  return state === 'unavailable' || state === 'unknown' || state === 'none';
}

function isMediaArtworkSession(value: unknown): value is MediaArtworkSession {
  return value !== null
    && typeof value === 'object'
    && 'artworkPath' in value
    && ((value as { artworkPath?: unknown }).artworkPath === null || typeof (value as { artworkPath?: unknown }).artworkPath === 'string');
}

function absoluteApiUrl(path: string): string {
  return `${API_BASE_URL.replace(/\/$/, '')}${path}`;
}

function playbackReferenceStorageKey(deviceId: string): string {
  return `${PLAYBACK_REFERENCE_STORAGE_PREFIX}${deviceId}`;
}

function readPlaybackReference(deviceId: string | undefined): MediaPlaybackReference | null {
  if (!deviceId || typeof window === 'undefined') return null;
  try {
    const serialized = window.sessionStorage.getItem(playbackReferenceStorageKey(deviceId));
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    return isMediaPlaybackReference(value) ? value : null;
  } catch {
    return null;
  }
}

function writePlaybackReference(deviceId: string | undefined, reference: MediaPlaybackReference | null): void {
  if (!deviceId || typeof window === 'undefined') return;
  try {
    const key = playbackReferenceStorageKey(deviceId);
    if (reference === null) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(key, JSON.stringify(reference));
  } catch {
    // Playback remains functional when browser storage is unavailable.
  }
}

export function useMediaPlayerModel({ device, title, isPreview = false, isProcessing = false, onCommand }: {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  isProcessing?: boolean;
  onCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
}) {
  const [artworkSession, setArtworkSession] = useState<{ sourceKey: string; artworkPath: string | null } | null>(null);
  const [failedArtworkUrl, setFailedArtworkUrl] = useState<string | null>(null);
  const [playbackClock, setPlaybackClock] = useState(() => Date.now());
  const [positionReference, setPositionReference] = useState<MediaPlaybackReference | null>(null);
  const positionReferenceRef = useRef<MediaPlaybackReference | null>(null);
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);
  const presentation = getMediaPlayerPresentation(device, isPreview);
  const commands = supportedCommands(device);
  const isPlaying = presentation.state === 'playing';
  const isOff = presentation.state === 'off';
  const unavailable = isUnavailable(presentation.state);
  const hasActiveSession = hasActiveMediaSession(presentation.state);
  const isIdle = !device || (!hasActiveSession && !unavailable);
  const playPauseCommand: MediaPlayerCommand | null = isPlaying
    ? 'media_pause'
    : commands.has('media_play') ? 'media_play' : null;
  const powerCommand: MediaPlayerCommand | null = isOff
    ? commands.has('turn_on') ? 'turn_on' : null
    : commands.has('turn_off') ? 'turn_off' : null;
  const canAct = Boolean(onCommand) && !isProcessing && !unavailable;
  const displayTitle = presentation.mediaTitle || title;
  const artworkSourceKey = hasActiveSession ? getMediaArtworkSourceKey(device?.lastKnownState) : null;
  const playbackSourceKey = `${artworkSourceKey ?? ''}\u0000${presentation.mediaTitle ?? ''}\u0000${presentation.mediaArtist ?? ''}\u0000${presentation.mediaDuration ?? ''}`;
  const hasPrevious = commands.has('media_previous_track');
  const hasNext = commands.has('media_next_track');
  const hasVolumeControl = commands.has('volume_set');
  const currentVolume = optimisticVolume ?? presentation.volume;
  const displayedMediaPosition = getDisplayedMediaPosition(presentation, playbackClock, positionReference);
  const playback = displayedMediaPosition !== null && presentation.mediaDuration !== null && presentation.mediaDuration > 0
    ? {
      position: displayedMediaPosition,
      duration: presentation.mediaDuration,
      progress: Math.min(100, Math.max(0, (displayedMediaPosition / presentation.mediaDuration) * 100)),
    }
    : null;
  const canActVolume = Boolean(onCommand) && !unavailable && hasVolumeControl;
  const invoke = (command: MediaPlayerCommand | null) => {
    if (!command || !canAct) return;
    onCommand?.(command);
  };
  const setVolume = (value: number) => {
    if (!canActVolume || currentVolume === null || !Number.isFinite(value)) return;
    const nextVolume = Math.max(0, Math.min(100, Math.round(value)));
    if (nextVolume === currentVolume) return;
    setOptimisticVolume(nextVolume);
    onCommand?.('volume_set', { volume: nextVolume });
  };
  const changeVolume = (delta: number) => { if (currentVolume !== null) setVolume(currentVolume + delta); };
  const VolumeIcon = currentVolume === null || currentVolume === 0
    ? VolumeX
    : currentVolume < 50 ? Volume1 : Volume2;

  useEffect(() => {
    const mediaPosition = presentation.mediaPosition;
    if (!isPlaying || mediaPosition === null || presentation.mediaDuration === null) {
      positionReferenceRef.current = null;
      setPositionReference(null);
      writePlaybackReference(device?.id, null);
      return;
    }

    const currentReference = positionReferenceRef.current ?? readPlaybackReference(device?.id);
    const reportedReferenceAt = presentation.mediaPositionUpdatedAt
      ? Date.parse(presentation.mediaPositionUpdatedAt)
      : Number.NaN;
    const nextReference = presentation.hasAuthoritativePlaybackReference
      || shouldResyncMediaPlaybackReference(
        currentReference,
        playbackSourceKey,
        mediaPosition,
        PLAYBACK_RESYNC_THRESHOLD_SECONDS,
      )
      ? {
        sourceKey: playbackSourceKey,
        position: mediaPosition,
        referenceAt: Number.isFinite(reportedReferenceAt) ? reportedReferenceAt : Date.now(),
      }
      : currentReference;

    positionReferenceRef.current = nextReference;
    setPositionReference(nextReference);
    writePlaybackReference(device?.id, nextReference);
  }, [device?.id, isPlaying, playbackSourceKey, presentation.hasAuthoritativePlaybackReference, presentation.mediaDuration, presentation.mediaPosition, presentation.mediaPositionUpdatedAt]);

  useEffect(() => {
    if (!isPlaying || presentation.mediaPosition === null || presentation.mediaDuration === null) return;
    setPlaybackClock(Date.now());
    const intervalId = window.setInterval(() => setPlaybackClock(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [isPlaying, presentation.hasAuthoritativePlaybackReference, presentation.mediaDuration, presentation.mediaPosition, presentation.mediaPositionUpdatedAt]);

  useEffect(() => {
    setOptimisticVolume(null);
  }, [device?.updatedAt]);

  useEffect(() => {
    let active = true;
    if (!device?.id || !artworkSourceKey) {
      setArtworkSession(null);
      return () => { active = false; };
    }

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/media/session`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`MEDIA_ARTWORK_SESSION_${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (active && isMediaArtworkSession(payload)) setArtworkSession({ sourceKey: artworkSourceKey, artworkPath: payload.artworkPath });
      })
      .catch(() => {
        if (active) setArtworkSession({ sourceKey: artworkSourceKey, artworkPath: null });
      });

    return () => { active = false; };
  }, [device?.id, artworkSourceKey]);

  const resolvedArtworkUrl = artworkSession && artworkSession.sourceKey === artworkSourceKey && artworkSession.artworkPath && hasActiveSession && !isIdle
    ? absoluteApiUrl(artworkSession.artworkPath) : null;
  const artworkUrl = resolvedArtworkUrl === failedArtworkUrl ? null : resolvedArtworkUrl;
  const reportArtworkFailure = () => setFailedArtworkUrl(artworkUrl);

  return {
    presentation, isPlaying, isOff, isIdle, canAct, displayTitle, powerCommand,
    playPauseCommand, hasPrevious, hasNext, hasVolumeControl, currentVolume,
    playback, canActVolume, invoke, changeVolume, setVolume, VolumeIcon, artworkUrl, reportArtworkFailure,
  };
}

export type MediaPlayerModel = ReturnType<typeof useMediaPlayerModel>;
