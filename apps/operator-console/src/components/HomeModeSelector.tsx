import React from 'react';
import { Moon, Home, Leaf, Coffee } from 'lucide-react';
import { cn } from '../lib/utils';

export type HomeMode = 'relax' | 'away' | 'night' | 'energy';

interface HomeModeSelectorProps {
  currentMode: HomeMode;
  onModeChange: (mode: HomeMode) => void;
}

const MODES = [
  { id: 'relax', label: 'Relax', icon: Coffee, color: 'from-orange-500/20 to-amber-500/20', activeColor: 'text-amber-500 border-amber-500/50 bg-amber-500/10' },
  { id: 'away', label: 'Fuera', icon: Home, color: 'from-blue-500/20 to-indigo-500/20', activeColor: 'text-blue-500 border-blue-500/50 bg-blue-500/10' },
  { id: 'night', label: 'Noche', icon: Moon, color: 'from-purple-500/20 to-indigo-500/20', activeColor: 'text-purple-500 border-purple-500/50 bg-purple-500/10' },
  { id: 'energy', label: 'Eco', icon: Leaf, color: 'from-emerald-500/20 to-teal-500/20', activeColor: 'text-emerald-500 border-emerald-500/50 bg-emerald-500/10' },
] as const;

export const HomeModeSelector: React.FC<HomeModeSelectorProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="flex items-center gap-3 p-2 bg-muted/20 backdrop-blur-xl rounded-[2.5rem] border border-border/40 mb-12 animate-in fade-in slide-in-from-top-4 duration-1000">
      {MODES.map((mode) => {
        const isActive = currentMode === mode.id;
        const Icon = mode.icon;
        
        return (
          <button
            key={mode.id}
            onClick={() => onModeChange(mode.id as HomeMode)}
            className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-[2rem] transition-all duration-500 group relative overflow-hidden border-2 border-transparent",
              isActive ? mode.activeColor : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {isActive && (
               <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 animate-pulse", mode.color)} />
            )}
            <Icon className={cn("w-4 h-4 transition-transform duration-500", isActive ? "scale-110" : "group-hover:scale-110")} />
            <span className="text-xs font-black uppercase tracking-widest relative z-10">{mode.label}</span>
          </button>
        );
      })}
    </div>
  );
};
