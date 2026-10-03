import { MinusCircle, Pause, Play, PlusCircle, Power, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import type { SnapshotDevice } from '../../../stores/useDeviceSnapshotStore';
import { IconButton } from '../../../components/ui/IconButton';
import { LegacyMediaPlayerCard } from './LegacyMediaPlayerCard';
import { MediaArtworkSquare } from './MediaArtworkSquare';
import { MediaVolumeSlider } from './MediaVolumeSlider';
import { formatMediaTime } from './mediaPlayback';
import type { MediaVariant } from './sectionCardCatalog';
import { MEDIA_VOLUME_STEP, useMediaPlayerModel, type MediaPlayerCommand, type MediaPlayerModel } from './useMediaPlayerModel';

export type { MediaPlayerCommand } from './useMediaPlayerModel';

interface MediaPlayerCardProps {
  device?: SnapshotDevice;
  title: string;
  isPreview?: boolean;
  isProcessing?: boolean;
  onCommand?: (command: MediaPlayerCommand, params?: Record<string, unknown>) => void;
  compact?: boolean;
  mediaVariant?: MediaVariant;
}

export function MediaPlayerCard({ device, title, isPreview = false, isProcessing = false, onCommand, compact = false, mediaVariant = 'premium' }: MediaPlayerCardProps) {
  const model = useMediaPlayerModel({ device, title, isPreview, isProcessing, onCommand });
  return mediaVariant === 'classic'
    ? <LegacyMediaPlayerCard title={title} compact={compact} model={model} />
    : <PremiumMediaPlayerCard title={title} compact={compact} model={model} />;
}

function PremiumMediaPlayerCard({ title, compact, model }: { title: string; compact: boolean; model: MediaPlayerModel }) {
  const { t } = useTranslation();
  const {
    presentation, isPlaying, isOff, isIdle, canAct, displayTitle, powerCommand,
    playPauseCommand, hasPrevious, hasNext, hasVolumeControl, currentVolume,
    playback, canActVolume, invoke, changeVolume, VolumeIcon, artworkUrl,
  } = model;
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
          <div className="min-w-0">
            <p className="min-w-0 truncate text-micro font-semibold uppercase tracking-label text-muted-foreground">{title}</p>
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
            onClick={(event) => { event.stopPropagation(); changeVolume(-MEDIA_VOLUME_STEP); }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg text-foreground/80 hover:text-primary"
          />
          <MediaVolumeSlider value={currentVolume} disabled={!canActVolume} onCommit={model.setVolume} />
          <IconButton
            icon={PlusCircle}
            label={t('dashboard.editor.sections.media_volume_up')}
            disabled={!canActVolume || currentVolume === null || currentVolume >= 100}
            onClick={(event) => { event.stopPropagation(); changeVolume(MEDIA_VOLUME_STEP); }}
            variant="ghost"
            size="sm"
            className="h-8 w-8 rounded-lg text-foreground/80 hover:text-primary"
          />
        </div>
      )}
    </div>
  );
}
