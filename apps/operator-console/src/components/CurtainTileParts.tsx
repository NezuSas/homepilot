import React from 'react';
import { useTranslation } from 'react-i18next';
import { Blinds, ArrowUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { DeviceTileShell } from './ui/DeviceTileShell';

export const STANDARD_DASHBOARD_CURTAIN_GEOMETRY = 'curtain-device-tile min-h-section-card-md sm:min-h-curtain-card';

/** Tile geometry shared by the live tile and its preview. */
export const getCurtainTileGeometry = (layout: 'manager' | 'dashboard', isCompact: boolean): string => (
  layout === 'dashboard'
    ? (isCompact ? 'curtain-device-tile min-h-section-card-sm' : STANDARD_DASHBOARD_CURTAIN_GEOMETRY)
    : 'curtain-device-tile min-h-curtain-card sm:min-h-curtain-card-lg'
);

interface CurtainBackdropProps {
  position: number;
  isMoving?: boolean;
}

export const CurtainBackdrop: React.FC<CurtainBackdropProps> = ({ position, isMoving = false }) => (
  <div
    className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-30 transition-[clip-path,opacity] [transition-duration:1500ms] ease-in-out"
    style={{
      clipPath: `inset(${position}% 0 0 0)`,
      background: 'repeating-linear-gradient(to bottom, hsl(var(--foreground) / 0.32) 0px, hsl(var(--foreground) / 0.32) 12px, hsl(var(--background) / 0.18) 13px, hsl(var(--foreground) / 0.32) 14px)',
    }}
    aria-hidden="true"
  >
    <div className="absolute inset-x-0 bottom-0 h-2 border-t border-foreground/20 bg-foreground/10 shadow-curtain-track" />
    {isMoving ? <div className="absolute inset-0 animate-pulse bg-primary/10" /> : null}
  </div>
);

/** Reserves the live cover's header, copy, class and position rows without
 * inventing device state or rendering actionable controls. It stays visually
 * hidden beneath the first-load skeleton. */
export function CurtainDeviceTileLoadingGeometry() {
  return <DeviceTileShell active={false} className={STANDARD_DASHBOARD_CURTAIN_GEOMETRY}>
    <div className="relative z-10 flex h-full min-w-0 flex-col justify-between">
      <div className="curtain-tile-header flex items-start justify-between gap-3">
        <span className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
        <span className="text-caption">&nbsp;</span>
      </div>
      <div className="curtain-tile-copy flex min-w-0 flex-col gap-1 overflow-hidden">
        <span className="text-card-title">&nbsp;</span>
        <span className="text-caption">&nbsp;</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-micro"><span>&nbsp;</span></div>
      <div className="curtain-tile-actions mt-4 flex min-w-0 flex-col gap-3">
        <div className="curtain-tile-position min-w-0 rounded-2xl border border-border/35 px-3 py-2">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-micro"><span>&nbsp;</span><span>&nbsp;</span></div>
          <div className="h-1.5" />
        </div>
      </div>
    </div>
  </DeviceTileShell>;
}

interface CurtainDeviceTilePreviewProps {
  title: string;
  roomName?: string;
  layout?: 'manager' | 'dashboard';
  density?: 'standard' | 'compact';
}

/**
 * Vista no interactiva de una cortina para el catálogo y el editor de tarjetas.
 * Mantiene la misma estructura visual que la tarjeta operativa sin simular acciones.
 */
export const CurtainDeviceTilePreview: React.FC<CurtainDeviceTilePreviewProps> = ({
  title,
  roomName,
  layout = 'dashboard',
  density = 'standard',
}) => {
  const { t } = useTranslation();
  const isCompact = density === 'compact';

  return (
    <DeviceTileShell
      active={false}
      className={cn(getCurtainTileGeometry(layout, isCompact))}
    >
      <CurtainBackdrop position={0} />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="curtain-tile-header flex items-start justify-between gap-3">
          <div className="curtain-tile-icon surface-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-border/60 bg-muted/60 text-muted-foreground sm:h-12 sm:w-12">
            <Blinds className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="text-caption font-medium text-muted-foreground">
              {t('common.cover.closed')}
            </span>
          </div>
        </div>

        <div className="curtain-tile-copy flex min-w-0 flex-col gap-1 overflow-hidden">
          <h4 className="curtain-tile-name truncate text-card-title font-bold tracking-tight text-foreground">{title}</h4>
          <span className="curtain-tile-room truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</span>
        </div>

        <div className={cn('curtain-tile-actions mt-4 flex flex-col', isCompact ? 'gap-0' : 'gap-2')}>
          <div className="curtain-tile-primary-action flex items-center rounded-2xl border border-border/20 bg-muted/40 p-1 shadow-inner">
            <div className="flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-label font-black uppercase tracking-widest text-primary-foreground">
              <ArrowUp className="h-3 w-3 opacity-60" />
              <span className="truncate">{t('common.actions.open')}</span>
            </div>
          </div>
          {!isCompact ? (
            <div className="flex w-full flex-col gap-1.5 px-1" aria-hidden="true">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/35">
                <div className="h-full w-0 bg-primary/50" />
              </div>
              <div className="flex justify-between text-micro font-semibold text-muted-foreground/70">
                <span>{t('common.cover.closed')}</span>
                <span>0%</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </DeviceTileShell>
  );
};
