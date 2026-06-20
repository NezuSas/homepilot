import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Home, Leaf, Coffee, Play } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

import type { HomeMode } from '../types';

interface HomeModeSelectorProps {
  currentMode: HomeMode;
  onModeChange: (mode: HomeMode) => void;
  linkedSceneName?: string;
  onExecuteLinkedScene?: () => void;
  isExecutingScene?: boolean;
}

const MODES = [
  { id: 'relax', label: 'Relax', icon: Coffee, color: 'from-primary/20 to-accent/10', activeColor: 'text-primary border-primary/50 bg-primary/10 shadow-depth-1' },
  { id: 'away', label: 'Fuera', icon: Home, color: 'from-muted/40 to-success/10', activeColor: 'text-primary border-primary/50 bg-primary/10 shadow-depth-1' },
  { id: 'night', label: 'Noche', icon: Moon, color: 'from-primary/20 to-background', activeColor: 'text-primary border-primary/50 bg-primary/10 shadow-depth-1' },
  { id: 'energy', label: 'Eco', icon: Leaf, color: 'from-success/20 to-success/5', activeColor: 'text-success border-success/50 bg-success/10' },
] as const;

export const HomeModeSelector: React.FC<HomeModeSelectorProps> = ({
  currentMode,
  onModeChange,
  linkedSceneName,
  onExecuteLinkedScene,
  isExecutingScene = false,
}) => {
  const { t } = useTranslation();
  return (
    <section
      className="w-full mb-2 animate-in fade-in slide-in-from-top-4 duration-1000"
      data-demo="home-mode-selector"
    >
      <div className="overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-3 p-2 bg-muted/20 backdrop-blur-xl rounded-panel border border-border/40 w-fit min-w-full md:min-w-0 mx-auto px-4 sm:px-2">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          const Icon = mode.icon;
          
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id as HomeMode)}
              className={cn(
                "flex items-center gap-3 px-6 py-3 rounded-[2rem] transition-all duration-500 group relative overflow-hidden border-2 border-transparent whitespace-nowrap shrink-0",
                isActive ? mode.activeColor : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {isActive && (
                 <div className={cn("absolute inset-0 bg-gradient-to-br opacity-20 animate-pulse", mode.color)} />
              )}
              <Icon className={cn("w-4 h-4 transition-transform duration-500", isActive ? "scale-110" : "group-hover:scale-110")} />
              <span className="text-label font-black uppercase tracking-widest relative z-10">
              {t(`modes.${mode.id}`)}
            </span>
            </button>
          );
        })}
      </div>
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded-card border border-border/50 bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-label font-black uppercase tracking-widest text-primary">{t(`modes.${currentMode}`)}</p>
          <p className="mt-1 text-body text-muted-foreground">{t(`modes.descriptions.${currentMode}`)}</p>
        </div>
        {linkedSceneName && onExecuteLinkedScene && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={onExecuteLinkedScene}
            isLoading={isExecutingScene}
            className="shrink-0"
          >
            {!isExecutingScene && <Play className="h-3.5 w-3.5" />}
            {t('modes.execute_scene', { name: linkedSceneName })}
          </Button>
        )}
      </div>
    </section>
  );
};
