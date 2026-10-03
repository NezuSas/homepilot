import { AudioLines, Cast, MinusCircle, Pause, Play, PlusCircle, Power, SkipBack, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../lib/utils';
import { IconButton } from '../../../components/ui/IconButton';
import { formatMediaTime } from './mediaPlayback';
import { MediaVolumeSlider } from './MediaVolumeSlider';
import { MEDIA_VOLUME_STEP, type MediaPlayerModel } from './useMediaPlayerModel';

/** Historical visual presentation; playback state and commands come from the shared model. */
export function LegacyMediaPlayerCard({ title, compact = false, model }: { title: string; compact?: boolean; model: MediaPlayerModel }) {
  const { t } = useTranslation();
  const {
    presentation, isPlaying, isOff, isIdle, canAct, displayTitle, powerCommand,
    playPauseCommand, hasPrevious, hasNext, hasVolumeControl, currentVolume,
    playback, canActVolume, invoke, changeVolume, VolumeIcon, artworkUrl, reportArtworkFailure,
  } = model;
  return (
    <div data-media-player="homepilot-classic" className={cn(
      'relative flex h-full min-h-media-card min-w-0 flex-col overflow-hidden rounded-section border border-border/60 bg-card text-foreground shadow-surface-card ring-1 ring-background/45',
      compact && 'min-h-section-card-sm',
    )}>
      {artworkUrl && (
        // Ambient bleed: a blurred, oversized copy of the artwork fills the
        // whole card so the color to the left of the cover matches it,
        // Home Assistant style, instead of a flat card-color gradient.
        <img
          src={artworkUrl}
          alt=""
          aria-hidden="true"
          onError={reportArtworkFailure}
          className="pointer-events-none absolute inset-0 h-full w-full scale-150 object-cover opacity-100 blur-3xl saturate-200"
        />
      )}
      {artworkUrl && (
        // The sharp cover fades into the blurred bleed on its left edge
        // instead of cutting off hard, so the seam between them disappears.
        <img
          src={artworkUrl}
          alt=""
          aria-hidden="true"
          onError={reportArtworkFailure}
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[52%] object-cover"
          style={{
            maskImage: 'linear-gradient(to left, black 55%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, black 55%, transparent 100%)',
          }}
        />
      )}
      {!artworkUrl && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className={cn('absolute inset-y-0 right-0 w-[62%] bg-[radial-gradient(ellipse_at_85%_16%,hsl(var(--primary)/0.24),transparent_58%)]', isIdle && 'opacity-50')} />
          <AudioLines className={cn('absolute -right-8 top-1/2 h-44 w-44 -translate-y-1/2 rotate-[-12deg]', isIdle ? 'text-muted-foreground/20' : 'text-primary/20')} strokeWidth={1.1} />
          <div className={cn('absolute bottom-0 right-7 top-0 w-px', isIdle ? 'bg-border/40' : 'bg-primary/20')} />
        </div>
      )}
      <div className={cn(
        'pointer-events-none absolute inset-0',
        artworkUrl
          ? 'bg-[linear-gradient(90deg,hsl(var(--card)/0.92)_0%,hsl(var(--card)/0.72)_35%,hsl(var(--card)/0.32)_65%,hsl(var(--card)/0.05)_100%)]'
          : 'bg-[radial-gradient(circle_at_92%_8%,hsl(var(--primary)/0.22),transparent_39%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--card)/0.74))]',
      )} />
      <div className={cn('relative flex min-w-0 items-start justify-between gap-2', compact ? 'px-3 pt-3' : 'px-4 pt-4')}>
        <div className="min-w-0">
          <span className={cn('flex min-w-0 items-center gap-2 font-semibold text-foreground', compact ? 'text-micro' : 'text-caption')}>
            <Cast className={cn('shrink-0 text-primary', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
            <span className="truncate">{title}</span>
          </span>
        </div>
      </div>

      <div className={cn('relative min-w-0', compact ? 'mt-2 px-3' : 'mt-3 px-4')}>
        <span style={{ minHeight: '2.5em' }} className={cn('block font-bold leading-tight text-foreground', compact ? 'line-clamp-2 text-body-compact' : 'line-clamp-2 text-card-title')}>{displayTitle}</span>
        <span className={cn('block truncate font-semibold text-muted-foreground', compact ? 'mt-0.5 text-micro' : 'mt-1 text-caption')}>
          {isIdle ? t('dashboard.editor.sections.media_idle') : presentation.mediaArtist || t('dashboard.editor.sections.media_player_label')}
        </span>
      </div>

        <div data-media-progress-slot className={cn('relative min-w-0 shrink-0', compact ? 'mt-2 px-3' : 'mt-3 px-4')}>
          <div className="mb-1 flex items-center justify-between gap-3 font-medium tabular-nums text-muted-foreground">
            <span className={compact ? 'text-micro' : 'text-caption'}>{playback ? formatMediaTime(playback.position) : '—'}</span>
            <span className={compact ? 'text-micro' : 'text-caption'}>{playback ? formatMediaTime(playback.duration) : '—'}</span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-foreground/20"
            role={playback ? 'progressbar' : undefined}
            aria-label={playback ? t('dashboard.editor.sections.media_progress', {
              current: formatMediaTime(playback.position),
              duration: formatMediaTime(playback.duration),
            }) : undefined}
            aria-valuemin={playback ? 0 : undefined}
            aria-valuemax={playback ? Math.round(playback.duration) : undefined}
            aria-valuenow={playback ? Math.round(playback.position) : undefined}
          >
            <span className="block h-full rounded-full bg-foreground/75 transition-[width] duration-1000" style={{ width: `${playback?.progress ?? 0}%` }} />
          </div>
        </div>

      <div className={cn(
        'relative mt-auto min-w-0',
        compact ? 'grid grid-cols-3 gap-1 px-3 pt-2' : 'mt-3 flex items-center gap-1.5 px-4',
        !hasVolumeControl && (compact ? 'pb-3' : 'mb-4'),
      )}>
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
          className={cn('rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-full' : 'h-9 w-9')}
        />
        {hasPrevious && (
          <IconButton
            icon={SkipBack}
            label={t('dashboard.editor.sections.media_previous')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_previous_track'); }}
            variant="ghost"
            size="md"
            className={cn('rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-full' : 'h-9 w-9')}
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
          className={cn('rounded-lg text-foreground hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-full' : 'h-9 w-9')}
        />
        {hasNext && (
          <IconButton
            icon={SkipForward}
            label={t('dashboard.editor.sections.media_next')}
            disabled={!canAct}
            onClick={(event) => { event.stopPropagation(); invoke('media_next_track'); }}
            variant="ghost"
            size="md"
            className={cn('rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-full' : 'h-9 w-9')}
          />
        )}
      </div>

      {hasVolumeControl && (
        <div className={cn('relative grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-1.5', compact ? 'mb-3 mt-2 px-3' : 'mb-4 mt-2 px-4')}>
          <span className={cn('grid shrink-0 place-items-center rounded-lg text-foreground/85', compact ? 'h-8 w-8' : 'h-9 w-9')} title={currentVolume === null ? undefined : `${currentVolume}%`}>
            <VolumeIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
          </span>
          <IconButton
            icon={MinusCircle}
            label={t('dashboard.editor.sections.media_volume_down')}
            disabled={!canActVolume || currentVolume === null || currentVolume <= 0}
            onClick={(event) => { event.stopPropagation(); changeVolume(-MEDIA_VOLUME_STEP); }}
            variant="ghost"
            size="md"
            className={cn('rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-8' : 'h-9 w-9')}
          />
          <MediaVolumeSlider value={currentVolume} disabled={!canActVolume} onCommit={model.setVolume} />
          <IconButton
            icon={PlusCircle}
            label={t('dashboard.editor.sections.media_volume_up')}
            disabled={!canActVolume || currentVolume === null || currentVolume >= 100}
            onClick={(event) => { event.stopPropagation(); changeVolume(MEDIA_VOLUME_STEP); }}
            variant="ghost"
            size="md"
            className={cn('rounded-lg text-foreground/85 hover:bg-foreground/10 hover:text-primary', compact ? 'h-8 w-8' : 'h-9 w-9')}
          />
        </div>
      )}
    </div>
  );
}
