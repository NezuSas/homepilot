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
  
  // State Inversion Logic
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
    
    // Optimistic feedback respecting inversion
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
        if (onActionExecute) onActionExecute(`${displayName} ${command} executed`);
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

  // Status dot color logic
  const dotColor = isOpening || isClosing 
    ? "status-dot-updating" 
    : (isOpen ? "status-dot-synced" : "bg-muted-foreground/20");

  const localizedState = t(`common.cover.${state}`, { defaultValue: state });

  return (
    <div className={cn(
      "relative group transition-all duration-700 rounded-[2rem] p-6 flex flex-col items-center justify-between text-center border-2 shadow-sm active:scale-95 h-full overflow-hidden",
      (isOpening || isClosing || isOpen) ? "bg-card/40 border-primary/20" : "bg-card/20 border-border/40 hover:border-primary/10",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {/* Premium Architectural Animation Layer */}
      <div className={cn(
        "absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out z-0",
        isOpen ? "bg-primary/[0.02]" : "bg-black/20"
      )}>
        <div 
          className={cn(
            "absolute inset-0 bg-black/40 transition-transform duration-[800ms] ease-in-out",
            isOpen ? "-translate-y-full" : "translate-y-0"
          )} 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 w-full h-full justify-between">
        {/* Icon Area */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-1000",
          (isOpening || isClosing || isOpen) ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground/30"
        )}>
          {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Blinds className={cn("w-5 h-5 opacity-70", (isOpening || isClosing) && "animate-premium-pulse")} />}
        </div>

        {/* Identity & State */}
        <div className="flex flex-col items-center min-w-0">
          <h4 className="text-xs font-bold truncate tracking-tight mb-1 opacity-90">{displayName}</h4>
          <div className="flex items-center gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
              {localizedState}
            </span>
          </div>
        </div>

        {/* Dynamic Actions */}
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
            disabled={!!isProcessing || isOpening || isClosing}
            className={cn(
              "w-full h-10 rounded-xl flex items-center justify-center gap-2 transition-all duration-500 font-black uppercase tracking-widest text-[8px] border-2",
              isOpen 
                ? "bg-secondary/40 border-primary/20 text-primary" 
                : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            )}
          >
            {isOpen ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />}
            {isOpen ? t('common.actions.close') : t('common.actions.open')}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
            disabled={!!isProcessing}
            className="w-full h-8 rounded-xl bg-transparent text-muted-foreground/30 flex items-center justify-center gap-2 transition-all hover:bg-destructive/5 hover:text-destructive active:scale-95 text-[7px] font-black uppercase tracking-[0.2em]"
          >
            <Square className="w-2.5 h-2.5 fill-current opacity-60" />
            {t('common.actions.stop')}
          </button>
        </div>
      </div>

      {/* Progress Line */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/5 overflow-hidden">
          <div 
            className="h-full bg-primary/30 transition-all duration-1000" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
