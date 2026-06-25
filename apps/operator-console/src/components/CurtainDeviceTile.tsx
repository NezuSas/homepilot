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

interface CurtainDeviceTileProps {
  device: Device;
  onUpdate?: (updated: Device) => void;
  onCommand?: (deviceId: string, command: string, params?: Record<string, unknown>) => Promise<Device | null>;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}

export const CurtainDeviceTile: React.FC<CurtainDeviceTileProps> = ({ 
  device, onUpdate, onCommand, roomName, isDuplicateName, onActionExecute 
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
  const parsePosition = (value: unknown): number | undefined => {
    if (value === null || value === undefined || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return undefined;
    return Math.min(100, Math.max(0, parsed));
  };
  const rawPosition = parsePosition(lastState.current_position)
    ?? parsePosition(lastState.position)
    ?? parsePosition(lastState.attributes?.current_position)
    ?? parsePosition(lastState.attributes?.position);
  const position = rawPosition !== undefined && device.invertState ? 100 - rawPosition : rawPosition;
  
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

  const canOpen = !unavailable && !!onCommand && canExecuteCommand(device, 'open');
  const canClose = !unavailable && !!onCommand && canExecuteCommand(device, 'close');
  const canStop = !unavailable && !!onCommand && canExecuteCommand(device, 'stop');
  const canSetPosition = !unavailable && !!onCommand && canExecuteCommand(device, 'set_position');
  const desiredCoverCommand = isOpen ? 'close' : 'open';
  const canExecutePrimary = desiredCoverCommand === 'open' ? canOpen : canClose;
  const primaryCoverCommand = canExecutePrimary ? desiredCoverCommand : null;
  const primaryCoverLabel = t(`common.actions.${desiredCoverCommand}`);

  return (
    <DeviceTileShell
      active={isMoving || isOpen}
      disabled={device.status === 'PENDING' || unavailable}
      syncing={isMoving}
      className="min-h-[12rem] sm:min-h-[13rem]"
    >
      
      {isMoving && (
        <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow pointer-events-none z-0" />
      )}

      <div
        className={cn(
          'absolute inset-0 z-0 pointer-events-none opacity-25 transition-transform [transition-duration:1500ms] ease-in-out',
          isOpen ? '-translate-y-full' : 'translate-y-0',
        )}
        style={{
          background: 'repeating-linear-gradient(to bottom, hsl(var(--foreground) / 0.32) 0px, hsl(var(--foreground) / 0.32) 12px, hsl(var(--background) / 0.18) 13px, hsl(var(--foreground) / 0.32) 14px)',
        }}
        aria-hidden="true"
      >
        <div className="absolute inset-x-0 bottom-0 h-2 border-t border-foreground/20 bg-foreground/10 shadow-[0_-4px_12px_hsl(var(--foreground)/0.18)]" />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
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

        <div className="flex flex-col gap-1 overflow-hidden">
           <h4 className="text-card-title font-bold truncate tracking-tight text-foreground">{displayName}</h4>
            <span className="text-caption text-muted-foreground">
              {roomName || t('common.unassigned')}
            </span>
        </div>

        {/* Dynamic Action Strip based on capabilities */}
        <div className="flex flex-col gap-3 mt-4">
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

              {canStop && (
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

          {canSetPosition && (
            <CoverPositionControl 
              initialPosition={position}
              onPositionChange={handlePositionChange}
              disabled={!!isProcessing}
              ariaLabel={t('common.cover.position', { defaultValue: 'Posición de cortina' })}
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
