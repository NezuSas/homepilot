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
  const actualState = lastState.state || 'unknown';
  const state = optimisticState || actualState;
  const position = lastState.current_position;
  
  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isOpen = state === 'open' || (position !== undefined && position > 0);

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    if (isProcessing) return;
    
    // Optimistic feedback
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
      "relative group transition-all duration-700 rounded-[2.5rem] p-6 flex flex-col gap-8 border-2 shadow-sm active:scale-95",
      (isOpening || isClosing || isOpen) ? "bg-primary/5 border-primary/40 shadow-premium" : "bg-card/20 border-border/40 hover:border-primary/20",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {/* Brand & Identity Area */}
      <div className="flex justify-between items-start">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-1000",
          (isOpening || isClosing || isOpen) ? "bg-primary text-primary-foreground premium-glow" : "bg-muted text-muted-foreground/40"
        )}>
           {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Blinds className={cn("w-6 h-6", (isOpening || isClosing) && "animate-atmospheric-pulse")} />}
        </div>
        
        {position !== undefined && (
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 leading-none mb-1">Apertura</span>
             <span className="text-xl font-black tracking-tighter tabular-nums text-primary/80">
                {position}%
             </span>
          </div>
        )}
      </div>

      {/* Primary Naming & State Alignment */}
      <div className="flex flex-col min-w-0">
        <h4 className="text-sm font-black truncate tracking-tight mb-1">{displayName}</h4>
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", dotColor)} />
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">
            {localizedState}
          </span>
        </div>
      </div>

      {/* Dynamic Action Hierarchy */}
      <div className="flex gap-3 pt-2">
        {/* Main Action: Toggles based on state */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
          disabled={!!isProcessing || isOpening || isClosing}
          className={cn(
            "flex-3 h-14 rounded-2xl flex items-center justify-center gap-3 transition-all duration-500 font-black uppercase tracking-widest text-[9px] premium-glow",
            isOpen ? "bg-foreground text-background shadow-xl" : "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
          )}
        >
          {isOpen ? (
            <>
              <ArrowDown className="w-4 h-4" />
              {t('common.actions.close', { defaultValue: 'Cerrar' })}
            </>
          ) : (
            <>
              <ArrowUp className="w-4 h-4" />
              {t('common.actions.open', { defaultValue: 'Abrir' })}
            </>
          )}
        </button>
        
        {/* Stop Action: Secondary */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
          disabled={!!isProcessing}
          className="flex-1 h-14 rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90 border-2 border-transparent hover:border-destructive/20"
          title={t('common.actions.stop', { defaultValue: 'Detener' })}
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>

      {/* Atmospheric progress sub-bar if position is known */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-8 right-8 h-1 bg-muted/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary/30 transition-all duration-2000 ease-in-out" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
