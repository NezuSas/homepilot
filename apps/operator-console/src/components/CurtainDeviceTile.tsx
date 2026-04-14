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
      "relative group transition-all duration-700 rounded-[2.5rem] p-8 flex flex-col items-center text-center gap-6 border-2 shadow-sm active:scale-95",
      (isOpening || isClosing || isOpen) ? "bg-card/40 border-primary/20 shadow-premium" : "bg-card/20 border-border/40 hover:border-primary/10",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {/* Icon Area - Subtler & Smaller */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-1000",
        (isOpening || isClosing || isOpen) ? "bg-primary/10 text-primary" : "bg-muted/40 text-muted-foreground/30"
      )}>
         {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Blinds className={cn("w-5 h-5 opacity-70", (isOpening || isClosing) && "animate-premium-pulse")} />}
      </div>

      {/* Identity & State - Calm Sentence Case */}
      <div className="flex flex-col items-center min-w-0">
        <h4 className="text-sm font-black truncate tracking-tight mb-1.5 opacity-90">{displayName}</h4>
        <div className="flex items-center gap-2">
          <div className={cn("w-1.5 h-1.5 rounded-full", dotColor)} />
          <span className="text-[10px] font-bold tracking-widest opacity-40 capitalize">
            {localizedState.toLowerCase()}
          </span>
        </div>
      </div>

      {/* Dynamic Action Hierarchy - Luxury Dark Style */}
      <div className="w-full flex flex-col gap-3 pt-2">
        {/* Main Action: Premium Primary Dark */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
          disabled={!!isProcessing || isOpening || isClosing}
          className={cn(
            "w-full h-12 rounded-xl flex items-center justify-center gap-2 transition-all duration-500 font-black uppercase tracking-widest text-[9px] border-2",
            isOpen 
              ? "bg-secondary/40 border-primary/20 text-primary shadow-lg" 
              : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 shadow-md"
          )}
        >
          {isOpen ? (
            <>
              <ArrowDown className="w-3.5 h-3.5" />
              {t('common.actions.close', { defaultValue: 'Cerrar' })}
            </>
          ) : (
            <>
              <ArrowUp className="w-3.5 h-3.5" />
              {t('common.actions.open', { defaultValue: 'Abrir' })}
            </>
          )}
        </button>
        
        {/* Stop Action: Subdued Secondary */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
          disabled={!!isProcessing}
          className="w-full h-10 rounded-xl bg-transparent text-muted-foreground/40 flex items-center justify-center gap-2 transition-all hover:bg-destructive/5 hover:text-destructive active:scale-95 border border-transparent hover:border-destructive/10"
        >
          <Square className="w-3 h-3 fill-current opacity-60" />
          <span className="text-[8px] font-black uppercase tracking-[0.2em]">{t('common.actions.stop', { defaultValue: 'Detener' })}</span>
        </button>
      </div>

      {/* Position Percentage - Minimal */}
      {position !== undefined && (
        <div className="absolute top-6 right-8">
           <span className="text-[10px] font-black tracking-tighter tabular-nums opacity-20">
              {position}%
           </span>
        </div>
      )}

      {/* Progress Line - Architecturally Integrated */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-10 right-10 h-[2px] bg-muted/5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary/20 transition-all duration-2000 ease-in-out" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
