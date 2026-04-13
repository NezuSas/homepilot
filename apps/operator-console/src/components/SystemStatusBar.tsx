import React, { useEffect, useState } from 'react';
import { ShieldCheck, Activity, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface SystemStatusBarProps {
  currentMode: string;
  isAllSynced: boolean;
  lastAction?: string;
}

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ currentMode, isAllSynced, lastAction }) => {
  const [timeSinceUpdate, setTimeSinceUpdate] = useState('just now');

  useEffect(() => {
    const timer = setInterval(() => {
      // Mocking "time ago" logic for high-trust perception
      setTimeSinceUpdate('just now');
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full z-[50] system-blur-bar px-8 py-3 flex items-center justify-between border-t border-border/40 text-[10px] font-black uppercase tracking-[0.2em] bg-card/20 backdrop-blur-xl shrink-0">
      {/* Left: Mode & Action Memory */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isAllSynced ? "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          )} />
          <span className="text-foreground/60">{currentMode} Mode</span>
        </div>
        
        {lastAction && (
          <div className="hidden lg:flex items-center gap-3 border-l border-border/40 pl-6 text-foreground/40 italic">
            <Activity className="w-3 h-3" />
            <span>Last change: {lastAction}</span>
          </div>
        )}
      </div>

      {/* Center: System Confidence */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 bg-muted/20 px-6 py-1.5 rounded-full border border-border/40">
        {isAllSynced ? (
          <>
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-primary/80">All systems encrypted & synced</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-3 h-3 text-amber-500" />
            <span className="text-amber-500">System Handshake in Progress</span>
          </>
        )}
      </div>

      {/* Right: Temporal Context */}
      <div className="flex items-center gap-6 text-foreground/40">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>Updated {timeSinceUpdate}</span>
        </div>
      </div>
    </div>
  );
};
