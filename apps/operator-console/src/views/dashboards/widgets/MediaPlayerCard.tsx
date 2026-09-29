import { MinusCircle, MoreVertical, Pause, Play, PlusCircle, Power, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../../components/ui/IconButton';
import { getMediaArtworkSourceKey } from './mediaArtwork';
import { MediaArtworkSquare } from './MediaArtworkSquare';
import { formatMediaTime, getDisplayedMediaPosition, getMediaPlayerPresentation, hasActiveMediaSession, isMediaPlaybackReference, shouldResyncMediaPlaybackReference, type MediaPlaybackReference } from './mediaPlayback';

export type MediaPlayerCommand = 'turn_on' | 'turn_off' | 'media_play' | 'media_pause' | 'media_previous_track' | 'media_next_track' | 'volume_set';

// Matches Home Assistant's default media control step (10%).
const VOLUME_STEP = 10;
const PLAYBACK_RESYNC_THRESHOLD_SECONDS = 2;
const PLAYBACK_REFERENCE_STORAGE_PREFIX = 'homepilot.media-playback-reference.';

interface MediaPlayerCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  isProcessing?: boolean;
  onCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
  compact?: boolean;
  isEditing?: boolean;
}
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

export function MediaPlayerCard({ device, title, isPreview = false, isProcessing = false, onCommand, compact = false, isEditing = false }: MediaPlayerCardProps) {
  const { t } = useTranslation();
  const [artworkSession, setArtworkSession] = useState<{ sourceKey: string; artworkPath: string | null } | null>(null);
  const [playbackClock, setPlaybackClock] = useState(() => Date.now());
  const [positionReference, setPositionReference] = useState<MediaPlaybackReference | null>(null);
  const positionReferenceRef = useRef<MediaPlaybackReference | null>(null);
  // Volume changes render instantly instead of waiting for the next device
  // snapshot; cleared once a fresh snapshot arrives (see effect below).
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
  // Volume has its own instant feedback, so it isn't gated by isProcessing
  // (which tracks play/pause/track changes on this same card).
  const canActVolume = Boolean(onCommand) && !unavailable && hasVolumeControl;
  const invoke = (command: MediaPlayerCommand | null) => {
    if (!command || !canAct) return;
    onCommand?.(command);
  };
  const changeVolume = (delta: number) => {
    if (!canActVolume || currentVolume === null) return;
    const nextVolume = Math.max(0, Math.min(100, currentVolume + delta));
    if (nextVolume === currentVolume) return;
    setOptimisticVolume(nextVolume);
    onCommand?.('volume_set', { volume: nextVolume });
  };
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
    // A fresh snapshot is the source of truth; drop the optimistic override
    // so the real volume takes over (they usually already match).
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

  const artworkUrl = artworkSession && artworkSession.sourceKey === artworkSourceKey && artworkSession.artworkPath && hasActiveSession && !isIdle
    ? absoluteApiUrl(artworkSession.artworkPath) : null;

  return (
    <div
      data-media-player="homepilot-premium"
      className={cn(
        'relative flex h-full min-h-media-card min-w-0 flex-col overflow-hidden rounded-section border border-border/55 bg-card text-foreground shadow-surface-card',
        compact && 'min-h-section-card-sm',
      )}
    >
      <div className={cn('relative grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-4', compact ? 'p-3' : 'p-4 sm:gap-5 sm:p-5')}>
        <MediaArtworkSquare artworkUrl={artworkUrl} compact={compact} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-micro font-semibold uppercase tracking-label text-muted-foreground">{title}</p>
            {isEditing && !compact && <MoreVertical className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
          </div>
          <p className={cn('mt-2 line-clamp-2 font-bold leading-tight text-foreground', compact ? 'text-body-compact' : 'text-card-title')}>{displayTitle}</p>
          <p className="mt-1 truncate text-caption font-medium text-muted-foreground">
            {isIdle ? t('dashboard.editor.sections.media_idle') : presentation.mediaArtist || t('dashboard.editor.sections.media_player_label')}
          </p>
        </div>
      </div>

      {playback && (
        <div className={cn('min-w-0', compact ? 'px-3' : 'px-4 sm:px-5')}>
          <div className="mb-1 flex items-center justify-between gap-3 text-micro font-medium tabular-nums text-muted-foreground">
            <span>{formatMediaTime(playback.position)}</span>
            <span>{formatMediaTime(playback.duration)}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-foreground/15"
            role="progressbar"
            aria-label={t('dashboard.editor.sections.media_progress', {
              current: formatMediaTime(playback.position),
              duration: formatMediaTime(playback.duration),
            })}
            aria-valuemin={0}
            aria-valuemax={Math.round(playback.duration)}
            aria-valuenow={Math.round(playback.position)}
          >
            <span className="block h-full rounded-full bg-primary transition-[width] duration-1000" style={{ width: `${playback.progress}%` }} />
          </div>
        </div>
      )}

      <div className={cn('mt-auto flex min-w-0 items-center justify-center gap-2', compact ? 'px-3 py-2' : 'px-4 py-3 sm:gap-3 sm:px-5')}>
        <IconButton
          icon={Power}
          label={t(isOff ? 'dashboard.editor.sections.media_turn_on' : 'dashboard.editor.sections.media_turn_off')}
          disabled={!canAct || !powerCommand}
          onClick={(event) => { event.stopPropagation(); invoke(powerCommand); }}
          variant="ghost"
          size="md"
          className="h-9 w-9 rounded-full text-muted-foreground hover:bg-foreground/10 hover:text-primary"
        />
        {hasPrevious && (
          <IconButton
            icon={SkipBack}
            label={t('dashboard.editor.sections.media_previous')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_previous_track'); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-full text-foreground hover:bg-foreground/10 hover:text-primary"
          />
        )}
        <IconButton
          icon={isPlaying ? Pause : Play}
          label={t(isPlaying ? 'dashboard.editor.sections.media_pause' : 'dashboard.editor.sections.media_play')}
          disabled={!canAct || !playPauseCommand}
          onClick={(event) => { event.stopPropagation(); invoke(playPauseCommand); }}
          variant="primary"
          size="md"
          className="homepilot-media-play-control h-11 w-11 rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary"
        />
        {hasNext && (
          <IconButton
            icon={SkipForward}
            label={t('dashboard.editor.sections.media_next')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_next_track'); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-full text-foreground hover:bg-foreground/10 hover:text-primary"
          />
        )}
      </div>

      {hasVolumeControl && (
        <div className={cn('flex min-w-0 items-center gap-2 border-t border-border/35', compact ? 'px-3 py-2' : 'px-4 py-3 sm:px-5')}>
          <VolumeIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
          <IconButton
            icon={MinusCircle}
            label={t('dashboard.editor.sections.media_volume_down')}
            disabled={!canActVolume || currentVolume === null || currentVolume <= 0}
            onClick={(event) => { event.stopPropagation(); changeVolume(-VOLUME_STEP); }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg text-foreground/80 hover:text-primary"
          />
          <div className="homepilot-media-volume-track h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/15" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary/85 transition-[width] duration-300" style={{ width: `${currentVolume ?? 0}%` }} />
          </div>
          <IconButton
            icon={PlusCircle}
            label={t('dashboard.editor.sections.media_volume_up')}
            disabled={!canActVolume || currentVolume === null || currentVolume >= 100}
            onClick={(event) => { event.stopPropagation(); changeVolume(VOLUME_STEP); }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg text-foreground/80 hover:text-primary"
          />
        </div>
      )}
    </div>
  );
}
