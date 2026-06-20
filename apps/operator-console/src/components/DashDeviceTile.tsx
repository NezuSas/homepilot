import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cpu, Lightbulb, ToggleRight, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { humanize, disambiguate } from '../lib/naming-utils';
import { hasCapability, canExecuteCommand } from '../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';
import { DeviceTileShell } from './ui/DeviceTileShell';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

export const DashDeviceTile: React.FC<{ 
  device: Device; 
  onUpdate?: (updated: Device) => void;
  onCommand?: (deviceId: string, command: string) => Promise<Device | null>;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}> = ({ device, onUpdate, onCommand, roomName, isDuplicateName, onActionExecute }) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const actualIsOn = lastState.on === true || lastState.state === 'on' || (Number(lastState.brightness) > 0) || (Number(lastState.power) > 0);
  const isOn = optimisticState !== null ? optimisticState : actualIsOn;
  const isOffline = device.status === 'PENDING' || isDeviceUnavailable(device);
  
  const isSonoff = device.integrationSource === 'sonoff';
  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  // Capability awareness
  const isLight = hasCapability(device, 'light');
  const isSwitch = hasCapability(device, 'switch');
  const isSensor = hasCapability(device, 'sensor') || hasCapability(device, 'binary_sensor');
  const canTurnOn = canExecuteCommand(device, 'turn_on');
  const canTurnOff = canExecuteCommand(device, 'turn_off');
  const canToggleCommand = canExecuteCommand(device, 'toggle');
  const nextCommand = isOn
    ? (canTurnOff ? 'turn_off' : (canToggleCommand ? 'toggle' : null))
    : (canTurnOn ? 'turn_on' : (canToggleCommand ? 'toggle' : null));
  const canToggle = !!onCommand && !isSensor && !!nextCommand;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || isOffline || !canToggle || !nextCommand) return;
    
    const nextState = !isOn;
    setOptimisticState(nextState);
    setIsProcessing(true);

    try {
      const updated = await onCommand(device.id, nextCommand);

      if (updated) {
        setOptimisticState(null);
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', { 
          name: displayName, 
          action: t(`common.actions.${nextCommand}`)
        }));
      } else {
        setOptimisticState(null);
      }
    } catch {
      setOptimisticState(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const Icon = isLight ? Lightbulb : (isSwitch ? ToggleRight : Cpu);

  const localizedState = isOffline
    ? t('device_states.unavailable')
    : (isOn ? t('device_states.on') : t('device_states.off'));
  const brightness = Number(lastState.brightness);
  const power = Number(lastState.power);
  const primaryMetric = isOffline
    ? localizedState
    : Number.isFinite(brightness) && brightness > 0
      ? `${Math.round(brightness)}%`
      : (Number.isFinite(power) && power > 0 ? `${power.toFixed(power >= 10 ? 0 : 1)}W` : localizedState);

  return (
    <DeviceTileShell
      onClick={handleToggle}
      data-demo="device-tile"
      active={isOn && !isOffline}
      interactive={canToggle && !isOffline}
      disabled={isOffline}
      syncing={isProcessing}
      aria-label={`${displayName}: ${localizedState}`}
      className={cn(
        (!isOn && isSonoff) && "hover:border-success/40",
      )}
    >
      {/* Edge Atmosphere Glow */}
      {isSonoff && isProcessing && (
        <div className="absolute inset-0 bg-success/5 animate-atmospheric-glow pointer-events-none" />
      )}
      
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className={cn(
          "surface-transition w-10 h-10 rounded-xl flex items-center justify-center",
          isOn ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground/50",
          (isSonoff && isProcessing) && "bg-success text-success-foreground scale-110 shadow-success/20 shadow-xl"
        )}>
          {isProcessing && isSonoff ? (
            <Zap className="w-5 h-5 animate-pulse" />
          ) : (
            <Icon className={cn("w-4 h-4", isOn && "animate-pulse")} />
          )}
        </div>

        <div className="flex min-w-0 flex-col items-end gap-1">
          <span className={cn(
            "max-w-[5.75rem] truncate rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-widest",
            isOn ? "border-primary/20 bg-primary/10 text-primary" : "border-border/50 bg-muted/30 text-muted-foreground"
          )}>
            {primaryMetric}
          </span>
          {isSonoff && (
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[7px] font-black uppercase tracking-widest",
              isOnline ? "border-success/20 bg-success/10 text-success" : "border-danger/20 bg-danger/10 text-danger"
            )}>
              {isOnline ? t('common.online') : t('common.offline')}
            </span>
          )}
        </div>
      </div>

      <div className="relative z-10 flex min-w-0 flex-col gap-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-black tracking-tight text-foreground">{displayName}</h4>
          <span className="mt-1 block truncate text-[8px] font-black uppercase tracking-[0.22em] text-muted-foreground/50">
            {roomName || t('common.unassigned')}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              isProcessing ? "status-dot-updating" : (isOn ? "bg-primary" : "bg-muted-foreground/35")
            )} />
            {isProcessing ? (
              <span className={cn("truncate text-[8px] font-black uppercase tracking-widest", isSonoff ? "text-success" : "text-muted-foreground")}>
                {isSonoff ? t('dashboards.status.edge_exec') : t('device_states.updating')}
              </span>
            ) : (
              <span className={cn(
                "truncate text-[9px] font-bold uppercase tracking-widest transition-opacity duration-300",
                isOn ? "text-primary" : "text-muted-foreground/55"
              )}>
                {localizedState}
              </span>
            )}
          </div>

          {isSonoff && (
            <span className="shrink-0 rounded border border-success/20 bg-success/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-success">
              {t('dashboards.status.local')}
            </span>
          )}
        </div>
      </div>
    </DeviceTileShell>
  );
};
