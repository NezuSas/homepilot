import React, { useState } from 'react';
import { 
  Blinds, ArrowUp, ArrowDown, Square, Loader2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { humanize, disambiguate } from '../lib/naming-utils';

interface DeviceState {
  state?: string;
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
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

  const lastState = (device.lastKnownState || {}) as DeviceState;
  const state = lastState.state || 'unknown';
  const position = lastState.current_position;
  
  const isOpening = state === 'opening';
  const isClosing = state === 'closing';
  const isOpen = state === 'open' || (position !== undefined && position > 0);

  const displayName = isDuplicateName 
    ? disambiguate(humanize(device.id, device.name), roomName)
    : humanize(device.id, device.name);

  const handleCommand = async (command: 'open' | 'close' | 'stop') => {
    if (isProcessing) return;
    
    setIsProcessing(command);
    try {
      const res = await fetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      
      if (res.ok) {
        const updated = await res.json();
        if (onUpdate) onUpdate(updated);
        if (onActionExecute) onActionExecute(`${displayName} ${command} dispatched`);
      }
    } catch (error) {
      console.error('Failed to execute cover command:', error);
    } finally {
      setIsProcessing(null);
    }
  };

  return (
    <div className={cn(
      "relative group transition-all duration-500 rounded-[2.5rem] p-6 flex flex-col gap-6 border-2 shadow-sm bg-card/20",
      (isOpening || isClosing || isOpen) ? "border-primary/40 bg-primary/5" : "border-border/40 hover:border-primary/20",
      device.status === 'PENDING' && "opacity-30 grayscale pointer-events-none"
    )}>
      {/* Header Info */}
      <div className="flex justify-between items-start">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700",
          (isOpening || isClosing || isOpen) ? "bg-primary text-primary-foreground premium-glow" : "bg-muted text-muted-foreground/40"
        )}>
          <Blinds className={cn("w-6 h-6", (isOpening || isClosing) && "animate-bounce")} />
        </div>
        
        <div className="flex flex-col items-end text-right">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 leading-none mb-1">
            {state === 'opening' ? 'Opening...' : (state === 'closing' ? 'Closing...' : state)}
          </span>
          {position !== undefined && (
             <span className="text-lg font-black tracking-tighter tabular-nums text-primary/80">
                {position}%
             </span>
          )}
        </div>
      </div>

      <div className="flex flex-col min-w-0">
        <h4 className="text-sm font-black truncate tracking-tight">{displayName}</h4>
        <span className="text-[9px] font-bold uppercase tracking-widest opacity-30 mt-0.5">{roomName || 'Generic'}</span>
      </div>

      {/* Control Actions */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand('open'); }}
          disabled={!!isProcessing || isOpening}
          className={cn(
            "aspect-square rounded-2xl flex items-center justify-center transition-all active:scale-90",
            state === 'open' ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary"
          )}
          title="Open"
        >
          {isProcessing === 'open' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand('stop'); }}
          disabled={!!isProcessing}
          className="aspect-square rounded-2xl bg-muted/40 text-muted-foreground flex items-center justify-center transition-all hover:bg-destructive/10 hover:text-destructive active:scale-90"
          title="Stop"
        >
          {isProcessing === 'stop' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); handleCommand('close'); }}
          disabled={!!isProcessing || isClosing}
          className={cn(
            "aspect-square rounded-2xl flex items-center justify-center transition-all active:scale-90",
            state === 'closed' ? "bg-foreground text-background" : "bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary"
          )}
          title="Close"
        >
          {isProcessing === 'close' ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Atmospheric progress sub-bar if position is known */}
      {position !== undefined && (
        <div className="absolute bottom-0 left-6 right-6 h-1 bg-muted/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary/40 transition-all duration-1000 ease-in-out" 
            style={{ width: `${position}%` }}
          />
        </div>
      )}
    </div>
  );
};
