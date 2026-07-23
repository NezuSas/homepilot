import { Cast, MinusCircle, MoreVertical, Pause, Play, PlusCircle, Power, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../../config';
import { apiFetch } from '../../../lib/apiClient';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../../components/ui/IconButton';

export type MediaPlayerCommand = 'turn_on' | 'turn_off' | 'media_play' | 'media_pause' | 'media_previous_track' | 'media_next_track' | 'volume_set';

// Matches Home Assistant's default media control step (10%).
const VOLUME_STEP = 10;

interface MediaPlayerCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  isProcessing?: boolean;
  onCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
}

interface MediaPresentation {
  state: string;
  mediaTitle: string | null;
  mediaArtist: string | null;
  volume: number | null;
}

interface MediaArtworkSession {
  readonly artworkPath: string | null;
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

export function getMediaPlayerPresentation(device?: SnapshotDevice, isPreview = false): MediaPresentation {
  if (!device && isPreview) {
    return {
      state: 'paused',
      mediaTitle: null,
      mediaArtist: null,
      volume: 50,
    };
  }

  const state = asRecord(device?.lastKnownState);
  const attributes = asRecord(state.attributes);
  return {
    state: normalizedState(firstText([state.state, state.value, attributes.state])),
    mediaTitle: firstText([state.media_title, attributes.media_title, state.title, attributes.title]),
    mediaArtist: firstText([state.media_artist, attributes.media_artist, state.media_album_artist, attributes.media_album_artist]),
    volume: numericVolume(state.volume_level ?? attributes.volume_level),
  };
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

export function MediaPlayerCard({ device, title, isPreview = false, isProcessing = false, onCommand }: MediaPlayerCardProps) {
  const { t } = useTranslation();
  const [artworkPath, setArtworkPath] = useState<string | null>(null);
  // Volume changes render instantly instead of waiting for the next device
  // snapshot; cleared once a fresh snapshot arrives (see effect below).
  const [optimisticVolume, setOptimisticVolume] = useState<number | null>(null);
  const presentation = getMediaPlayerPresentation(device, isPreview);
  const commands = supportedCommands(device);
  const isPlaying = presentation.state === 'playing';
  const isOff = presentation.state === 'off';
  const unavailable = isUnavailable(presentation.state);
  const playPauseCommand: MediaPlayerCommand | null = isPlaying
    ? 'media_pause'
    : commands.has('media_play') ? 'media_play' : null;
  const powerCommand: MediaPlayerCommand | null = isOff
    ? commands.has('turn_on') ? 'turn_on' : null
    : commands.has('turn_off') ? 'turn_off' : null;
  const canAct = Boolean(onCommand) && !isProcessing && !unavailable;
  const displayTitle = presentation.mediaTitle || title;
  const hasPrevious = commands.has('media_previous_track');
  const hasNext = commands.has('media_next_track');
  const hasVolumeControl = commands.has('volume_set');
  const currentVolume = optimisticVolume ?? presentation.volume;
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
    // A fresh snapshot is the source of truth; drop the optimistic override
    // so the real volume takes over (they usually already match).
    setOptimisticVolume(null);
  }, [device?.updatedAt]);

  useEffect(() => {
    let active = true;
    if (!device?.id) {
      setArtworkPath(null);
      return () => { active = false; };
    }

    void apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(device.id)}/media/session`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`MEDIA_ARTWORK_SESSION_${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (active && isMediaArtworkSession(payload)) setArtworkPath(payload.artworkPath);
      })
      .catch(() => {
        if (active) setArtworkPath(null);
      });

    return () => { active = false; };
  }, [device?.id, device?.updatedAt]);

  const artworkUrl = artworkPath ? absoluteApiUrl(artworkPath) : null;

  return (
    <div className="relative flex h-full min-h-media-card flex-col overflow-hidden rounded-section border border-border/60 bg-card text-foreground shadow-surface-card ring-1 ring-background/45">
      {artworkUrl && (
        // Ambient bleed: a blurred, oversized copy of the artwork fills the
        // whole card so the color to the left of the cover matches it,
        // Home Assistant style, instead of a flat card-color gradient.
        <img
          src={artworkUrl}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-100 blur-3xl saturate-200"
        />
      )}
      {artworkUrl && (
        // The sharp cover fades into the blurred bleed on its left edge
        // instead of cutting off hard, so the seam between them disappears.
        <img
          src={artworkUrl}
          alt=""
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[52%] object-cover"
          style={{
            maskImage: 'linear-gradient(to left, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, black 55%, transparent 100%)',
          }}
        />
      )}
      <div className={cn(
        'pointer-events-none absolute inset-0',
        artworkUrl
          ? 'bg-[linear-gradient(90deg,hsl(var(--card)/0.92)_0%,hsl(var(--card)/0.72)_35%,hsl(var(--card)/0.32)_65%,hsl(var(--card)/0.05)_100%)]'
          : 'bg-[radial-gradient(circle_at_92%_8%,hsl(var(--primary)/0.22),transparent_39%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--card)/0.74))]',
      )} />
      <div className="relative flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-caption font-semibold text-foreground">
            <Cast className="h-4 w-4 shrink-0 text-primary" />
            <span className="truncate">{title}</span>
          </span>
        </div>
        <MoreVertical className="h-4 w-4 shrink-0 text-foreground/75" aria-hidden="true" />
      </div>

      <div className="relative mt-3 min-w-0 px-4">
        <span className="block line-clamp-2 text-card-title font-bold leading-tight text-foreground">{displayTitle}</span>
        <span className="mt-1 block truncate text-caption font-semibold text-muted-foreground">
          {presentation.mediaArtist || t('dashboard.editor.sections.media_player_label')}
        </span>
      </div>

      <div className={cn("relative mt-3 flex items-center gap-1.5 px-4", !hasVolumeControl && "mb-4")}>
        <IconButton
          icon={Power}
          label={t(isOff ? 'dashboard.editor.sections.media_turn_on' : 'dashboard.editor.sections.media_turn_off')}
          disabled={!canAct || !powerCommand}
          onClick={(event) => {
            event.stopPropagation();
            invoke(powerCommand);
          }}
          variant="ghost"
          size="md"
          className="h-9 w-9 rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary"
        />
        {hasPrevious && (
          <IconButton
            icon={SkipBack}
            label={t('dashboard.editor.sections.media_previous')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_previous_track'); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary"
          />
        )}
        <IconButton
          icon={isPlaying ? Pause : Play}
          label={t(isPlaying ? 'dashboard.editor.sections.media_pause' : 'dashboard.editor.sections.media_play')}
          disabled={!canAct || !playPauseCommand}
          onClick={(event) => {
            event.stopPropagation();
            invoke(playPauseCommand);
          }}
          variant="ghost"
          size="md"
          className="h-9 w-9 rounded-lg text-foreground hover:bg-foreground/10 hover:text-primary"
        />
        {hasNext && (
          <IconButton
            icon={SkipForward}
            label={t('dashboard.editor.sections.media_next')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_next_track'); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary"
          />
        )}
      </div>

      {hasVolumeControl && (
        <div className="relative mb-4 mt-2 flex items-center gap-1.5 px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-foreground/85" title={currentVolume === null ? undefined : `${currentVolume}%`}>
            <VolumeIcon className="h-4 w-4" />
          </span>
          <IconButton
            icon={MinusCircle}
            label={t('dashboard.editor.sections.media_volume_down')}
            disabled={!canActVolume || currentVolume === null || currentVolume <= 0}
            onClick={(event) => { event.stopPropagation(); changeVolume(-VOLUME_STEP); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary"
          />
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/20">
            <span className="block h-full rounded-full bg-primary/85 transition-[width] duration-300" style={{ width: `${currentVolume ?? 0}%` }} />
          </div>
          <IconButton
            icon={PlusCircle}
            label={t('dashboard.editor.sections.media_volume_up')}
            disabled={!canActVolume || currentVolume === null || currentVolume >= 100}
            onClick={(event) => { event.stopPropagation(); changeVolume(VOLUME_STEP); }}
            variant="ghost"
            size="md"
            className="h-9 w-9 rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary"
          />
        </div>
      )}
    </div>
  );
}
