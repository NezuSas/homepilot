import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Blinds, ArrowUp, ArrowDown, Square, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { humanize, disambiguate } from '../lib/naming-utils';
import { canExecuteCommand } from '../lib/deviceCapabilities';
import { CoverPositionControl } from './CoverPositionControl';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

interface DeviceState {
  state?: 'open' | 'closed' | 'opening' | 'closing' | 'unknown';
  current_position?: number;
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
  const position = lastState.current_position;
  
  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isOpen = state === 'open' || (position !== undefined && position > 0);
  const isMoving = isOpening || isClosing;

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const isSonoff = device.integrationSource === 'sonoff';

  const handleCommand = async (command: string, params?: Record<string, unknown>) => {
    if (isProcessing || !onCommand) return;
    
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

  const localizedState = t(`common.cover.${state}`, { defaultValue: state });

  const canOpen = !!onCommand && canExecuteCommand(device, 'open');
  const canClose = !!onCommand && canExecuteCommand(device, 'close');
  const canStop = !!onCommand && canExecuteCommand(device, 'stop');
  const canSetPosition = !!onCommand && canExecuteCommand(device, 'set_position');

  return (
    <div className={cn(
      "relative group transition-all duration-700 rounded-[2rem] p-4 flex min-h-[10.5rem] flex-col justify-between border h-full overflow-hidden hover:-translate-y-1",
      (isMoving || isOpen) ? "device-state-on" : "device-state-off",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {isMoving && (
        <div className="absolute inset-0 bg-primary/5 animate-atmospheric-glow pointer-events-none z-0" />
      )}

      <div 
        className={cn(
          "absolute inset-0 pointer-events-none transition-transform [transition-duration:1500ms] ease-in-out z-0 opacity-40",
          isOpen ? "-translate-y-full" : "translate-y-0"
        )}
        style={{
          background: "repeating-linear-gradient(to bottom, rgba(0,0,0,0.8) 0px, rgba(0,0,0,0.8) 12px, rgba(255,255,255,0.05) 13px, rgba(0,0,0,0.8) 14px)"
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-[8px] bg-white/10 border-t border-white/20 shadow-[0_-4px_12px_rgba(0,0,0,0.5)]" />
      </div>

      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex justify-between items-start">
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700",
            (isMoving || isOpen) ? "bg-primary text-primary-foreground shadow-lg" : "bg-muted text-muted-foreground/40"
          )}>
            {isMoving ? (
              isOpening ? <ArrowUp className="w-5 h-5 animate-pulse" /> : <ArrowDown className="w-5 h-5 animate-pulse" />
            ) : (
              isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Blinds className="w-5 h-5" />
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
             {isSonoff && (
               <span className="text-[7px] font-black uppercase tracking-widest bg-success/10 text-success border border-success/20 px-1.5 py-0.5 rounded shadow-sm">{t('dashboards.status.local')}</span>
             )}
             <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors duration-500", 
                  isMoving ? "status-dot-updating animate-ping" : (isOpen ? "bg-primary/80" : "bg-muted-foreground/40")
                )} />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                   {localizedState}
                </span>
             </div>
          </div>
        </div>

        <div className="flex flex-col gap-1 overflow-hidden">
           <h4 className="text-xs font-bold truncate tracking-tight text-foreground">{displayName}</h4>
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40">
              {roomName || t('common.unassigned')}
            </span>
        </div>

        {/* Dynamic Action Strip based on capabilities */}
        <div className="flex flex-col gap-3 mt-4">
          {(canOpen || canClose || canStop) && (
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-2xl border border-border/20 backdrop-blur-md shadow-inner">
              {(canOpen || canClose) && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
                  disabled={!!isProcessing || isMoving}
                  className={cn(
                    "flex-1 h-9 rounded-xl flex items-center justify-center gap-2 transition-all duration-500 active:scale-95 border",
                    isOpen 
                      ? "bg-background border-border text-foreground hover:bg-muted" 
                      : "bg-primary border-primary/20 text-primary-foreground shadow-lg shadow-primary/10"
                  )}
                >
                  {isOpen ? <ArrowDown className="w-3 h-3 opacity-60" /> : <ArrowUp className="w-3 h-3 opacity-60" />}
                  <span className="text-[9px] font-black uppercase tracking-widest">
                    {isOpen ? t('common.actions.close') : t('common.actions.open')}
                  </span>
                </button>
              )}

              {canStop && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
                  disabled={!!isProcessing}
                  className={cn(
                    "w-10 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border border-border/10",
                    isMoving ? "bg-secondary/20 text-secondary-foreground" : "bg-muted/20 text-muted-foreground/40 hover:bg-muted hover:text-foreground"
                  )}
                  title={t('common.actions.stop')}
                >
                  {isProcessing === 'stop' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3 fill-current" />}
                </button>
              )}
            </div>
          )}

          {canSetPosition && (
            <CoverPositionControl 
              initialPosition={position} 
              onPositionChange={handlePositionChange}
              disabled={!!isProcessing}
            />
          )}
        </div>
      </div>

      {position !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/20 overflow-hidden">
          <div 
            className="h-full bg-primary/40 transition-all duration-1000 ease-out" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
