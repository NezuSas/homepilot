import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, BriefcaseBusiness, Leaf, Armchair, Play } from 'lucide-react';
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
  { id: 'relax', icon: Armchair, activeColor: 'border-primary/55 bg-primary/12 text-primary shadow-depth-1' },
  { id: 'away', icon: BriefcaseBusiness, activeColor: 'border-primary/45 bg-primary/10 text-primary shadow-depth-1' },
  { id: 'night', icon: Moon, activeColor: 'border-mode-night/50 bg-mode-night/12 text-mode-night shadow-depth-1' },
  { id: 'energy', icon: Leaf, activeColor: 'border-accent/55 bg-accent/12 text-accent shadow-depth-1' },
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
      className="w-full animate-in fade-in slide-in-from-top-4 duration-700"
      data-demo="home-mode-selector"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-section-title font-semibold tracking-tight text-foreground">{t('dashboard.modes_title', { defaultValue: 'Modos del hogar' })}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          const Icon = mode.icon;
          
          return (
            <button
              key={mode.id}
              onClick={() => onModeChange(mode.id as HomeMode)}
              className={cn(
                "group relative flex min-h-[6.25rem] items-center gap-4 overflow-hidden rounded-card border px-5 py-4 text-left surface-transition interactive-lift",
                isActive ? mode.activeColor : "border-border/60 bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"
              )}
            >
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border surface-transition', isActive ? 'border-current/20 bg-current/10' : 'border-border/60 bg-muted/60')}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="relative z-10 min-w-0">
                <span className="block text-card-title font-semibold text-current">{t(`modes.${mode.id}`)}</span>
                <span className="mt-1 block text-caption text-muted-foreground">{isActive ? t('dashboard.mode_active', { defaultValue: 'Activo' }) : t('device_states.off')}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded-card border border-border/50 bg-card/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-body font-semibold text-foreground">{t(`modes.${currentMode}`)}</p>
          <p className="mt-0.5 text-caption text-muted-foreground">{t(`modes.descriptions.${currentMode}`)}</p>
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
