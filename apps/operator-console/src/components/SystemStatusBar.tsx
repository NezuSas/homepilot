import { ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

interface SystemStatusBarProps {
  currentMode: string;
  isAllSynced: boolean;
  lastAction?: string;
}

export const SystemStatusBar: React.FC<SystemStatusBarProps> = ({ currentMode, isAllSynced }) => {
  return (
    <div className="w-full shrink-0 px-4 md:px-8 py-3 flex items-center justify-between border-t border-border/40 text-[10px] font-black uppercase tracking-[0.2em] bg-card/20 backdrop-blur-xl">
      {/* Left: Mode & Action Memory */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isAllSynced ? "bg-primary shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]"
          )} />
          <span className="text-foreground/60">Modo {currentMode}</span>
        </div>
      </div>

      {/* Center: System Confidence (Simplified) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-4 bg-muted/20 px-6 py-1.5 rounded-full border border-border/40">
        {isAllSynced ? (
          <>
            <ShieldCheck className="w-3 h-3 text-primary" />
            <span className="text-primary/80">Sistema estable</span>
          </>
        ) : (
          <>
            <ShieldAlert className="w-3 h-3 text-amber-500" />
            <span className="text-amber-500">Sincronizando sistema</span>
          </>
        )}
      </div>

      {/* Right: Temporal Context (Simplified) */}
      <div className="flex items-center gap-6 text-foreground/40">
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3" />
          <span>Actualizado ahora</span>
        </div>
      </div>
    </div>
  );
};
