import React, { useState } from 'react';
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
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

interface DeviceState {
  state?: 'open' | 'closed' | 'opening' | 'closing' | 'unknown' | 'unavailable';
  current_position?: unknown;
  position?: unknown;
  attributes?: Record<string, unknown>;
  [key: string]: unknown;
}

const parseCoverPosition = (value: unknown): number | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(100, Math.max(0, parsed));
};

interface CurtainBackdropProps {
  position: number;
  isMoving?: boolean;
}

const CurtainBackdrop: React.FC<CurtainBackdropProps> = ({ position, isMoving = false }) => (
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

const getCoverClassKey = (attributes?: Record<string, unknown>): string => {
  const value = attributes?.device_class;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'generic';
};

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
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [optimisticState, setOptimisticState] = useState<string | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const rawState = lastState.state || 'unknown';
  const unavailable = isDeviceUnavailable(device);
  
  const getFunctionalState = (s: string) => {
    if (!device.invertState) return s;
    const map: Record<string, string> = {
      'open': 'closed',
      'closed': 'open',
      'opening': 'closing',
      'closing': 'opening'
    };
    return map[s] || s;
  };

  const state = optimisticState || getFunctionalState(rawState);
  const rawPosition = parseCoverPosition(lastState.current_position)
    ?? parseCoverPosition(lastState.position)
    ?? parseCoverPosition(lastState.attributes?.current_position)
    ?? parseCoverPosition(lastState.attributes?.position);
  const rawTiltPosition = parseCoverPosition(lastState.attributes?.current_tilt_position);
  const position = rawPosition !== undefined && device.invertState ? 100 - rawPosition : rawPosition;
  const coverClassKey = getCoverClassKey(lastState.attributes);
  
  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isMoving = isOpening || isClosing;
  const isOpen = !unavailable && (position !== undefined ? position > 0 : state === 'open');
  const displayState = unavailable
    ? 'unavailable'
    : isMoving
    ? state
    : position !== undefined
      ? (position > 0 ? 'open' : 'closed')
      : state;
  const visualPosition = position ?? (displayState === 'open' ? 100 : 0);

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const isSonoff = device.integrationSource === 'sonoff';

  const handleCommand = async (command: string, params?: Record<string, unknown>) => {
    if (isProcessing || unavailable || !onCommand) return;
    
    if (!canExecuteCommand(device, command)) {
      console.warn(`[UI] Command ${command} not allowed for device ${device.id}`);
      return;
    }

    if (command === 'open') setOptimisticState('opening');
    else if (command === 'close') setOptimisticState('closing');
    
    setIsProcessing(command);
    try {
      const updated = await onCommand(device.id, command, params);

      if (updated) {
        setOptimisticState(null);
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', { 
          name: displayName, 
          action: t(`common.actions.${command}`) 
        }));
      } else {
        setOptimisticState(null);
      }
    } catch (error) {
      console.error('Failed to execute cover command:', error);
      setOptimisticState(null);
    } finally {
      setIsProcessing(null);
    }
  };

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
      className={cn(
        layout === 'dashboard'
          ? (isCompact ? 'min-h-section-card-sm' : 'min-h-section-card-md sm:min-h-curtain-card')
          : 'min-h-curtain-card sm:min-h-curtain-card-lg',
      )}
    >
      
      {isMoving && (
        <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow pointer-events-none z-0" />
      )}

      <CurtainBackdrop position={visualPosition} isMoving={isMoving} />

      <div className="relative z-10 flex h-full min-w-0 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className={cn(
            "surface-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-card border sm:h-12 sm:w-12",
            (isMoving || isOpen) ? "border-primary/25 bg-primary/15 text-primary" : "border-border/60 bg-muted/60 text-muted-foreground"
          )}>
            {isMoving ? (
              isOpening ? <ArrowUp className="w-5 h-5 animate-pulse" /> : <ArrowDown className="w-5 h-5 animate-pulse" />
            ) : (
              isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Blinds className="w-5 h-5" />
            )}
          </div>

          <div className="flex min-w-0 flex-col items-end gap-1">
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

        <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
           <h4 className="truncate text-card-title font-bold tracking-tight text-foreground">{displayName}</h4>
            <span className="truncate text-caption text-muted-foreground">
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
        <div className="mt-4 flex min-w-0 flex-col gap-3">
          {position !== undefined && !unavailable && !isCompact ? (
            <div className="min-w-0 rounded-2xl border border-border/35 bg-background/35 px-3 py-2 shadow-inner">
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
            <div className="flex items-center gap-1.5 rounded-2xl border border-border/20 bg-muted/40 p-1 shadow-inner backdrop-blur-md">
              {primaryCoverCommand && (
                <Button
                  type="button"
                  variant={isOpen ? 'outline' : 'primary'}
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleCommand(primaryCoverCommand); }}
                  disabled={!!isProcessing || isMoving}
                  className={cn(
                    "h-9 min-w-0 flex-1 rounded-xl text-label font-black uppercase tracking-widest",
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
                    "w-10 h-9 rounded-xl border border-border/10",
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
            <CoverPositionControl 
              initialPosition={position}
              onPositionChange={handlePositionChange}
              disabled={!!isProcessing}
              ariaLabel={t('common.cover.position')}
            />
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
      className={cn(
        layout === 'dashboard'
          ? (isCompact ? 'min-h-section-card-sm' : 'min-h-section-card-md sm:min-h-curtain-card')
          : 'min-h-curtain-card sm:min-h-curtain-card-lg',
      )}
    >
      <CurtainBackdrop position={0} />

      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <div className="surface-transition flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-border/60 bg-muted/60 text-muted-foreground sm:h-12 sm:w-12">
            <Blinds className="h-5 w-5" />
          </div>
          <div className="flex items-center gap-1.5 pt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
            <span className="text-caption font-medium text-muted-foreground">
              {t('common.cover.closed')}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
          <h4 className="truncate text-card-title font-bold tracking-tight text-foreground">{title}</h4>
          <span className="truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</span>
        </div>

        <div className={cn('mt-4 flex flex-col', isCompact ? 'gap-0' : 'gap-2')}>
          <div className="flex items-center rounded-2xl border border-border/20 bg-muted/40 p-1 shadow-inner">
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