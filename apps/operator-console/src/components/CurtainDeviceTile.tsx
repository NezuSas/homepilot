import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Blinds, ArrowUp, ArrowDown, Square, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { humanize, disambiguate } from '../lib/naming-utils';

interface DeviceState {
  state?: 'open' | 'closed' | 'opening' | 'closing' | 'unknown';
  current_position?: number;
  [key: string]: unknown;
}

interface Device {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  type: string;
  status: 'PENDING' | 'ASSIGNED';
  invertState?: boolean;
  lastKnownState: Record<string, unknown> | null;
}

interface CurtainDeviceTileProps {
  device: Device;
  onUpdate?: (updated: Device) => void;
  roomName?: string;
  isDuplicateName?: boolean;
  onActionExecute?: (label: string) => void;
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const CurtainDeviceTile: React.FC<CurtainDeviceTileProps> = ({ 
  device, onUpdate, roomName, isDuplicateName, onActionExecute 
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

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    if (isProcessing) return;
    
    if (command === 'open') setOptimisticState('opening');
    else if (command === 'close') setOptimisticState('closing');
    
    setIsProcessing(command);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
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
    } catch (error) {
      console.error('Failed to execute cover command:', error);
      setOptimisticState(null);
    } finally {
      setIsProcessing(null);
    }
  };

  const localizedState = t(`common.cover.${state}`, { defaultValue: state });

  return (
    <div className={cn(
      "relative group transition-all duration-700 rounded-[2rem] p-6 flex flex-col items-center justify-between text-center border-2 h-full overflow-hidden",
      (isOpening || isClosing || isOpen) ? "bg-card/40 border-primary/20" : "bg-card/25 border-border/40 hover:border-primary/20",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {/* SHUTTER SYSTEM: Architectural Visual State */}
      <div className={cn(
        "absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out z-0",
        isOpen ? "bg-transparent" : "bg-black/20"
      )}>
        <div 
          className={cn(
            "absolute inset-0 bg-black/60 transition-transform duration-[1200ms] ease-in-out border-b border-white/10 shadow-inner",
            isOpen ? "-translate-y-full" : "translate-y-0"
          )} 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full h-full justify-between gap-5 py-2">
        {/* Top: Icon & Identity */}
        <div className="flex flex-col items-center gap-4">
          <div className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-1000",
            (isOpening || isClosing || isOpen) ? "bg-primary/10 text-primary/60" : "bg-muted/40 text-muted-foreground/30"
          )}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Blinds className="w-5 h-5 opacity-60" />}
          </div>

          <div className="flex flex-col items-center min-w-0">
            <h4 className="text-sm font-bold truncate tracking-tight text-foreground/90 px-2">{displayName}</h4>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full transition-colors duration-500", 
                (isOpening || isClosing) ? "status-dot-updating" : (isOpen ? "bg-primary/80" : "bg-muted-foreground/40")
              )} />
              <span className="text-[11px] font-medium tracking-wide opacity-60">
                {localizedState}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom: Solid & Elegant Actions (Visible by default) */}
        <div className="w-full max-w-[140px] flex flex-col gap-2 mb-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
            disabled={!!isProcessing || isOpening || isClosing}
            className={cn(
              "w-full h-10 rounded-xl flex items-center justify-center gap-3 transition-all duration-500 text-[11px] font-bold border-2",
              isOpen 
                ? "bg-secondary/15 border-border/40 text-foreground/80 hover:bg-secondary/25" 
                : "bg-primary/15 border-primary/30 text-primary hover:bg-primary/25"
            )}
          >
            {isOpen ? <ArrowDown className="w-3 h-3 opacity-60" /> : <ArrowUp className="w-3 h-3 opacity-60" />}
            {isOpen ? t('common.actions.close') : t('common.actions.open')}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
            disabled={!!isProcessing}
            className="w-full h-8 rounded-lg bg-transparent text-muted-foreground/40 flex items-center justify-center gap-2 transition-all hover:bg-muted/40 hover:text-foreground/70 active:scale-95 text-[10px] font-bold"
          >
            <Square className="w-2.5 h-2.5 fill-current opacity-40" />
            {t('common.actions.stop')}
          </button>
        </div>
      </div>

      {/* Atmospheric Progress Line */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/10 overflow-hidden">
          <div 
            className="h-full bg-primary/40 transition-all duration-1000" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
