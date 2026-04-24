import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Cpu, Lightbulb, ToggleRight, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { humanize, disambiguate } from '../lib/naming-utils';
import { hasCapability, canExecuteCommand } from '../lib/deviceCapabilities';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

interface DeviceState {
  on?: boolean;
  state?: 'on' | 'off';
  brightness?: number;
  power?: number;
  [key: string]: unknown;
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const DashDeviceTile: React.FC<{ 
  device: Device; 
  onUpdate?: (updated: Device) => void;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}> = ({ device, onUpdate, roomName, isDuplicateName, onActionExecute }) => {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [optimisticState, setOptimisticState] = useState<boolean | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const actualIsOn = lastState.on === true || lastState.state === 'on' || (Number(lastState.brightness) > 0) || (Number(lastState.power) > 0);
  const isOn = optimisticState !== null ? optimisticState : actualIsOn;
  const isOffline = device.status === 'PENDING';
  
  const isSonoff = device.integrationSource === 'sonoff';
  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  // Capability awareness
  const isLight = hasCapability(device, 'light');
  const isSwitch = hasCapability(device, 'switch');
  const isSensor = hasCapability(device, 'sensor') || hasCapability(device, 'binary_sensor');
  const canToggle = canExecuteCommand(device, 'toggle') || canExecuteCommand(device, 'turn_on');

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing || isOffline || isSensor || !canToggle) return;
    
    const nextState = !isOn;
    setOptimisticState(nextState);
    setIsProcessing(true);

    try {
      const command = nextState ? 'turn_on' : 'turn_off';
      const res = await apiFetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (res.ok) {
        const updated = await res.json();
        setOptimisticState(null);
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(t('common.feedback.action_success', { 
          name: displayName, 
          action: t(`common.actions.${command}`) 
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
    ? t('device_states.error') 
    : (isOn ? t('device_states.on') : t('device_states.off'));

  return (
    <div 
      onClick={handleToggle}
      data-demo="device-tile"
      className={cn(
        "relative group transition-all duration-500 rounded-[2rem] p-4 flex flex-col justify-between border-2 h-full hover:-translate-y-1 hover:shadow-xl overflow-hidden",
        (canToggle && !isOffline) ? "cursor-pointer active:scale-95" : "cursor-default",
        isOn ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" : "bg-card border-border shadow-md hover:border-primary/20",
        (!isOn && isSonoff) && "hover:border-success/40",
        isOffline && "opacity-30 grayscale pointer-events-none hover:translate-y-0"
      )}
    >
      {/* Edge Atmosphere Glow */}
      {isSonoff && isProcessing && (
        <div className="absolute inset-0 bg-success/5 animate-atmospheric-glow pointer-events-none" />
      )}
      
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 z-10",
        isOn ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground/40",
        (isSonoff && isProcessing) && "bg-success text-white scale-110 shadow-success/20 shadow-xl"
      )}>
        {isProcessing && isSonoff ? (
          <Zap className="w-5 h-5 animate-pulse" />
        ) : (
          <Icon className={cn("w-4 h-4", isOn && "animate-pulse")} />
        )}
      </div>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <h4 className="text-xs font-bold truncate tracking-tight">{displayName}</h4>
          {isSonoff && (
            <span className="text-[7px] font-black uppercase tracking-widest bg-success/10 text-success border border-success/20 px-1 py-0.5 rounded shrink-0">{t('dashboards.status.local')}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 min-h-[12px]">
          {isProcessing ? (
            <>
              <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isSonoff ? "bg-success animate-ping" : "status-dot-updating")} />
              <span className={cn("text-[8px] font-black uppercase tracking-widest truncate", isSonoff ? "text-success" : "opacity-40")}>
                {isSonoff ? t('dashboards.status.edge_exec') : t('device_states.updating')}
              </span>
            </>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={cn(
                "text-[9px] font-medium tracking-wide transition-opacity duration-300 truncate",
                isOn ? "text-primary opacity-90" : "text-muted-foreground/50"
              )}>
                {localizedState}
              </span>
              {isSonoff && (
                <>
                  <span className="w-1 h-1 bg-border rounded-full shrink-0" />
                  <span className={cn("text-[8px] font-black uppercase tracking-widest shrink-0", isOnline ? "text-success" : "text-destructive opacity-80")}>
                    {isOnline ? t('common.online') : t('common.offline')}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
