import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Lightbulb, Power, ToggleRight } from 'lucide-react';
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

interface DashDeviceTileProps {
  device: Device;
  onUpdate?: (updated: Device) => void;
  onCommand?: (deviceId: string, command: string) => Promise<Device | null>;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}

export const DashDeviceTile: React.FC<DashDeviceTileProps> = ({ device, onUpdate, onCommand, roomName, isDuplicateName, onActionExecute }) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null);
  const lastState = (device.lastKnownState || {}) as DeviceState;
  const actualIsOn = lastState.on === true || lastState.state === 'on' || Number(lastState.brightness) > 0 || Number(lastState.power) > 0;
  const isOn = optimisticState ?? actualIsOn;
  const isOffline = device.status === 'PENDING' || isDeviceUnavailable(device);
  const isSonoff = device.integrationSource === 'sonoff';
  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;
  const displayName = isDuplicateName ? disambiguate(humanize(device.id, device.name), roomName) : humanize(device.id, device.name);
  const isLight = hasCapability(device, 'light');
  const isSwitch = hasCapability(device, 'switch');
  const isSensor = hasCapability(device, 'sensor') || hasCapability(device, 'binary_sensor');
  const canTurnOn = canExecuteCommand(device, 'turn_on');
  const canTurnOff = canExecuteCommand(device, 'turn_off');
  const canToggleCommand = canExecuteCommand(device, 'toggle');
  const nextCommand = isOn ? (canTurnOff ? 'turn_off' : canToggleCommand ? 'toggle' : null) : (canTurnOn ? 'turn_on' : canToggleCommand ? 'toggle' : null);
  const canToggle = !!onCommand && !isSensor && !!nextCommand;

  const handleToggle = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isProcessing || isOffline || !canToggle || !nextCommand) return;
    setOptimisticState(!isOn);
    setIsProcessing(true);
    try {
      const updated = await onCommand(device.id, nextCommand);
      setOptimisticState(null);
      if (updated) {
        onUpdate?.(updated);
        onActionExecute?.(t('common.feedback.action_success', { name: displayName, action: t(`common.actions.${nextCommand}`) }));
      }
    } catch {
      setOptimisticState(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const Icon = isLight ? Lightbulb : isSwitch ? ToggleRight : Cpu;
  const localizedState = isOffline ? t('device_states.unavailable') : isOn ? t('device_states.on') : t('device_states.off');
  const brightness = Number(lastState.brightness);
  const power = Number(lastState.power);
  const detail = !isOffline && Number.isFinite(brightness) && brightness > 0
    ? `${Math.round(brightness)}%`
    : !isOffline && Number.isFinite(power) && power > 0
      ? `${power.toFixed(power >= 10 ? 0 : 1)}W`
      : localizedState;

  return (
    <DeviceTileShell
      onClick={handleToggle}
      data-demo="device-tile"
      active={isOn && !isOffline}
      tone={isLight ? 'light' : 'brand'}
      interactive={canToggle && !isOffline}
      disabled={isOffline}
      syncing={isProcessing}
      aria-label={`${displayName}: ${localizedState}`}
      className="min-h-[8.25rem]"
    >
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <span className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-card border surface-transition',
            isOn && !isOffline
              ? isLight ? 'border-light-active/25 bg-light-active/15 text-light-active' : 'border-primary/25 bg-primary/15 text-primary'
              : 'border-border/60 bg-muted/60 text-muted-foreground',
          )}>
            <Icon className={cn('h-5 w-5', isProcessing && 'animate-pulse')} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-card-title font-semibold tracking-tight text-foreground">{displayName}</span>
            <span className={cn('mt-1 block text-caption font-medium', isOn && !isOffline ? isLight ? 'text-light-active' : 'text-primary' : 'text-muted-foreground')}>
              {detail}
            </span>
          </span>
        </div>
        {canToggle && !isOffline && (
          <span className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border surface-transition',
            isOn ? isLight ? 'border-light-active/30 bg-light-active text-light-active-foreground' : 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background/35 text-muted-foreground',
          )}>
            <Power className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="relative z-10 mt-5 flex items-center justify-between gap-3 border-t border-border/45 pt-3">
        <span className="truncate text-caption text-muted-foreground">{roomName || t('common.unassigned')}</span>
        {isSonoff && <span className={cn('shrink-0 text-micro font-semibold', isOnline ? 'text-success' : 'text-danger')}>{isOnline ? t('common.online') : t('common.offline')}</span>}
      </div>
    </DeviceTileShell>
  );
};
