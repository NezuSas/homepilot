import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Blinds, ArrowUp, ArrowDown, Square, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { humanize, disambiguate } from '../lib/naming-utils';
import { canExecuteCommand } from '../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import { CoverPositionControl } from './CoverPositionControl';
import { Button } from './ui/Button';
import { DeviceTileShell } from './ui/DeviceTileShell';
import { CurtainBackdrop, getCurtainTileGeometry } from './CurtainTileParts';
import { deriveCurtainView, type CurtainDeviceState } from './curtainDeviceModel';
import { useCurtainCommand } from './useCurtainCommand';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

export { CurtainDeviceTileLoadingGeometry, CurtainDeviceTilePreview } from './CurtainTileParts';

interface CurtainDeviceTileProps {
  device: Device;
  onUpdate?: (updated: Device) => void;
  onCommand?: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<Device | null>;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
  layout?: 'manager' | 'dashboard';
  density?: 'standard' | 'compact';
}

export const CurtainDeviceTile: React.FC<CurtainDeviceTileProps> = ({
  device, onUpdate, onCommand, roomName, isDuplicateName, onActionExecute, layout = 'manager', density = 'standard'
}) => {
  const { t } = useTranslation();

  const lastState = (device.lastKnownState || {}) as CurtainDeviceState;
  const unavailable = isDeviceUnavailable(device);

  const displayName = isDuplicateName
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const { isProcessing, optimisticState, handleCommand } = useCurtainCommand({
    device, unavailable, displayName, onUpdate, onCommand, onActionExecute,
  });

  const {
    position, rawTiltPosition, coverClassKey, isOpening, isMoving, isOpen, displayState, visualPosition,
  } = deriveCurtainView({ lastState, invertState: device.invertState, unavailable, optimisticState });

  const isSonoff = device.integrationSource === 'sonoff';

  const handlePositionChange = (pos: number) => {
    handleCommand('set_position', { position: pos });
  };

  const localizedState = t(`common.cover.${displayState}`, { defaultValue: displayState });

  const coverClassLabel = t(`common.cover.classes.${coverClassKey}`, {
    defaultValue: t('common.cover.classes.generic'),
  });
  const tiltLabel = rawTiltPosition === undefined
    ? null
    : t('common.cover.tilt_value', { value: Math.round(rawTiltPosition) });
  const canOpen = !unavailable && !!onCommand && canExecuteCommand(device, 'open');
  const canClose = !unavailable && !!onCommand && canExecuteCommand(device, 'close');
  const canStop = !unavailable && !!onCommand && canExecuteCommand(device, 'stop');
  const canSetPosition = !unavailable && !!onCommand && canExecuteCommand(device, 'set_position');
  const desiredCoverCommand = isOpen ? 'close' : 'open';
  const canExecutePrimary = desiredCoverCommand === 'open' ? canOpen : canClose;
  const primaryCoverCommand = canExecutePrimary ? desiredCoverCommand : null;
  const primaryCoverLabel = t(`common.actions.${desiredCoverCommand}`);
  const isCompact = density === 'compact';

  return (
    <DeviceTileShell
      active={isMoving || isOpen}
      disabled={device.status === 'PENDING' || unavailable}
      syncing={isMoving}
      className={cn(getCurtainTileGeometry(layout, isCompact))}
    >

      {isMoving && (
        <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow pointer-events-none z-0" />
      )}

      <CurtainBackdrop position={visualPosition} isMoving={isMoving} />

      <div className="relative z-10 flex h-full min-w-0 flex-col justify-between">
        <div className="curtain-tile-header flex items-start justify-between gap-3">
          <div className={cn(
            "curtain-tile-icon surface-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-card border sm:h-12 sm:w-12",
            (isMoving || isOpen) ? "border-primary/25 bg-primary/15 text-primary" : "border-border/60 bg-muted/60 text-muted-foreground"
          )}>
            {isMoving ? (
              isOpening ? <ArrowUp className="w-5 h-5 animate-pulse" /> : <ArrowDown className="w-5 h-5 animate-pulse" />
            ) : (
              isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Blinds className="w-5 h-5" />
            )}
          </div>

          <div className="curtain-tile-state flex min-w-0 flex-col items-end gap-1">
             {isSonoff && (
               <span className="rounded-pill border border-success/20 bg-success/10 px-2 py-0.5 text-micro font-semibold text-success">{t('dashboards.status.local')}</span>
             )}
             <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors duration-500",
                  isMoving ? "status-dot-updating animate-ping" : (isOpen ? "bg-primary/80" : "bg-muted-foreground/40")
                )} />
                <span className="truncate text-caption font-medium text-muted-foreground">
                   {localizedState}
                </span>
             </div>
          </div>
        </div>

        <div className="curtain-tile-copy flex min-w-0 flex-col gap-1 overflow-hidden">
           <h4 className="curtain-tile-name truncate text-card-title font-bold tracking-tight text-foreground">{displayName}</h4>
            <span className="curtain-tile-room truncate text-caption text-muted-foreground">
              {roomName || t('common.unassigned')}
            </span>
        </div>
          {!isCompact && (coverClassKey !== 'generic' || tiltLabel) ? (
            <div className="flex min-w-0 items-center gap-2 text-micro font-medium text-muted-foreground/80">
              <span className="truncate">{coverClassLabel}</span>
              {tiltLabel ? <span className="shrink-0">{tiltLabel}</span> : null}
            </div>
          ) : null}


        {/* Dynamic Action Strip based on capabilities */}
        <div className="curtain-tile-actions mt-4 flex min-w-0 flex-col gap-3">
          {position !== undefined && !unavailable && !isCompact ? (
            <div className="curtain-tile-position min-w-0 rounded-2xl border border-border/35 bg-background/35 px-3 py-2 shadow-inner">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-micro font-black uppercase tracking-status text-muted-foreground">
                <span className="truncate">{t('common.cover.position')}</span>
                <span className="shrink-0 tabular-nums text-foreground">{Math.round(visualPosition)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out" style={{ width: `${visualPosition}%` }} />
              </div>
            </div>
          ) : null}
          {(primaryCoverCommand || canStop) && (
            <div className="curtain-tile-primary-action flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/20 bg-muted/40 p-1 shadow-inner backdrop-blur-md">
              {primaryCoverCommand && (
                <Button
                  type="button"
                  variant={isOpen ? 'outline' : 'primary'}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleCommand(primaryCoverCommand); }}
                  disabled={!!isProcessing || isMoving}
                  className={cn(
                    "min-w-[5.5rem] flex-1",
                    isOpen && "bg-background"
                  )}
                >
                  {isOpen ? <ArrowDown className="w-3 h-3 opacity-60" /> : <ArrowUp className="w-3 h-3 opacity-60" />}
                  <span className="truncate">{primaryCoverLabel}</span>
                </Button>
              )}

              {canStop && !isCompact && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
                  disabled={!!isProcessing}
                  className={cn(
                    "w-10 border border-border/10",
                    isMoving ? "bg-secondary/20 text-secondary-foreground" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                  )}
                  title={t('common.actions.stop')}
                >
                  {isProcessing === 'stop' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
                </Button>
              )}
            </div>
          )}

          {canSetPosition && !isCompact && (
            <div className="curtain-tile-position-control">
              <CoverPositionControl
              initialPosition={position}
              onPositionChange={handlePositionChange}
              disabled={!!isProcessing}
              ariaLabel={t('common.cover.position')}
              />
            </div>
          )}
        </div>
      </div>

      {position !== undefined && !unavailable && (
        <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-muted/20">
          <div
            className="h-full bg-primary/50 transition-all duration-1000 ease-out"
            style={{ width: `${visualPosition}%` }}
          />
        </div>
      )}

    </DeviceTileShell>
  );
};
