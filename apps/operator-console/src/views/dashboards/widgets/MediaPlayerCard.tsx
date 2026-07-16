import { Music2, Pause, Play, Power, Volume2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';

export type MediaPlayerCommand = 'turn_on' | 'turn_off' | 'media_play' | 'media_pause';

interface MediaPlayerCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  isProcessing?: boolean;
  onCommand?: (command: MediaPlayerCommand) => void;
}

interface MediaPresentation {
  state: string;
  mediaTitle: string | null;
  mediaArtist: string | null;
  volume: number | null;
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

export function MediaPlayerCard({ device, title, isPreview = false, isProcessing = false, onCommand }: MediaPlayerCardProps) {
  const { t } = useTranslation();
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
  const stateLabel = unavailable
    ? t('dashboard.editor.sections.media_unavailable')
    : isPlaying
      ? t('dashboard.editor.sections.media_playing')
      : presentation.state === 'paused'
        ? t('dashboard.editor.sections.media_paused')
        : isOff
          ? t('dashboard.editor.sections.media_off')
          : t('dashboard.editor.sections.media_ready');

  const invoke = (command: MediaPlayerCommand | null) => {
    if (!command || !canAct) return;
    onCommand?.(command);
  };

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-section border border-border/60 bg-card/95 p-4 text-foreground shadow-surface-card ring-1 ring-background/45">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,hsl(var(--primary)/0.18),transparent_38%)]" />
      <div className="relative flex items-start justify-between gap-3">
        <span className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-sm',
          isPlaying && 'shadow-primary-warm ring-1 ring-primary/25',
        )}>
          <Music2 className="h-5 w-5" />
        </span>
        <span className={cn(
          'rounded-full border px-2.5 py-1 text-micro font-black uppercase tracking-control',
          isPlaying ? 'border-primary/35 bg-primary/10 text-primary' : 'border-border/55 bg-background/75 text-muted-foreground',
        )}>
          {stateLabel}
        </span>
      </div>

      <div className="relative mt-auto min-w-0 pt-4">
        <span className="block line-clamp-2 text-card-title font-black leading-tight text-foreground">{displayTitle}</span>
        <span className="mt-1 block truncate text-caption font-semibold text-muted-foreground">
          {presentation.mediaArtist || t('dashboard.editor.sections.media_player_label')}
        </span>
      </div>

      <div className="relative mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!canAct || !powerCommand}
          onClick={(event) => {
            event.stopPropagation();
            invoke(powerCommand);
          }}
          aria-label={t(isOff ? 'dashboard.editor.sections.media_turn_on' : 'dashboard.editor.sections.media_turn_off')}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/65 text-muted-foreground transition hover:border-primary/45 hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Power className="h-4 w-4" />
        </button>
        <button
          type="button"
          disabled={!canAct || !playPauseCommand}
          onClick={(event) => {
            event.stopPropagation();
            invoke(playPauseCommand);
          }}
          aria-label={t(isPlaying ? 'dashboard.editor.sections.media_pause' : 'dashboard.editor.sections.media_play')}
          className="grid h-10 flex-1 place-items-center rounded-xl bg-primary text-primary-foreground shadow-primary-warm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/65 text-muted-foreground" title={presentation.volume === null ? undefined : `${presentation.volume}%`}>
          <Volume2 className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}
