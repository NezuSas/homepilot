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

  const localizedState = t(`common.cover.${state}`, { defaultValue: state });

  return (
    <div className={cn(
      "relative group transition-all duration-700 rounded-[2rem] p-5 flex flex-col items-center justify-between text-center border-2 h-full overflow-hidden",
      (isOpening || isClosing || isOpen) ? "bg-card/30 border-primary/10" : "bg-card/20 border-border/40 hover:border-primary/10",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      
      {/* SHUTTER SYSTEM: Architectural Visual State */}
      <div className={cn(
        "absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out z-0",
        isOpen ? "bg-transparent" : "bg-black/10"
      )}>
        <div 
          className={cn(
            "absolute inset-0 bg-black/50 transition-transform duration-[1200ms] ease-in-out border-b border-white/5 shadow-2xl",
            isOpen ? "-translate-y-full" : "translate-y-0"
          )} 
        />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full h-full justify-between gap-4">
        {/* Top Section: Icon & Identity */}
        <div className="flex flex-col items-center gap-2 pt-4">
          <div className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-1000 bg-muted/20",
            (isOpening || isClosing || isOpen) ? "text-primary/40" : "text-muted-foreground/10"
          )}>
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Blinds className="w-3.5 h-3.5 opacity-40 shrink-0" />}
          </div>

          <div className="flex flex-col items-center min-w-0">
            <h4 className="text-[11px] font-semibold truncate tracking-tight opacity-60 px-2">{displayName}</h4>
            <span className="text-[8px] font-medium tracking-wide opacity-20 uppercase mt-0.5">
              {localizedState}
            </span>
          </div>
        </div>

        {/* Bottom Section: Ghost Actions (Premium Minimalism) */}
        <div className="w-full max-w-[120px] flex flex-col gap-1 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand(isOpen ? 'close' : 'open'); }}
            disabled={!!isProcessing || isOpening || isClosing}
            className={cn(
              "w-full h-8 rounded-lg flex items-center justify-center gap-2 transition-all duration-500 text-[9px] font-bold border",
              isOpen 
                ? "bg-secondary/5 border-border/20 text-foreground/30 hover:bg-secondary/10" 
                : "bg-primary/5 border-primary/10 text-primary/60 hover:bg-primary/10"
            )}
          >
            {isOpen ? <ArrowDown className="w-2.5 h-2.5 opacity-30" /> : <ArrowUp className="w-2.5 h-2.5 opacity-30" />}
            {isOpen ? t('common.actions.close') : t('common.actions.open')}
          </button>
          
          <button
            onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
            disabled={!!isProcessing}
            className="w-full h-7 rounded-lg bg-transparent text-muted-foreground/10 flex items-center justify-center gap-1.5 transition-all hover:bg-muted/10 hover:text-foreground/30 active:scale-95 text-[8px] font-bold"
          >
            <Square className="w-2 h-2 fill-current opacity-20" />
            {t('common.actions.stop')}
          </button>
        </div>
      </div>

      {/* Atmospheric Progress Line */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white/5 overflow-hidden">
          <div 
            className="h-full bg-primary/20 transition-all duration-1000" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
