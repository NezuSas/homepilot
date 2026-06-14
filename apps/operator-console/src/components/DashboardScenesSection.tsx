import React from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Plus, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { Button } from './ui/Button';

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  description?: string;
  actions: SceneAction[];
}

interface DashboardScenesSectionProps {
  scenes: Scene[];
  allDevices: SnapshotDevice[];
  roomProcessing: string | null;
  onCreateScene: () => void;
  onSceneExecute: (scene: Scene) => void;
}

export const DashboardScenesSection: React.FC<DashboardScenesSectionProps> = ({
  scenes,
  allDevices,
  roomProcessing,
  onCreateScene,
  onSceneExecute,
}) => {
  const { t } = useTranslation();

  if (scenes.length === 0) {
    return (
      <div className="py-12 px-6 rounded-[2.5rem] border-2 border-dashed border-border/40 flex flex-col items-center justify-center text-center bg-card/5">
        <Zap className="w-12 h-12 text-primary opacity-20 mb-4" />
        <p className="text-xs font-black uppercase tracking-widest text-muted-foreground/40">{t('scenes.empty_title')}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateScene}
          className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary/60"
        >
          {t('dashboard.scene_create')}
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xs font-black uppercase tracking-[0.3em] text-foreground/30">{t('dashboard.atmosphere_recipes')}</h2>
        <Button
          variant="ghost"
          onClick={onCreateScene}
          className="group gap-2 text-xs font-black text-primary/60 hover:text-primary px-0 h-auto uppercase tracking-wider"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3] group-hover:rotate-90 transition-transform duration-500" />
          {t('dashboard.new_scene')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {scenes.map((scene) => {
          const sceneActions = scene.actions || [];
          const localActions = sceneActions.filter((action) => {
            const device = allDevices.find((candidate) => candidate.id === action.deviceId);
            return device?.integrationSource === 'sonoff';
          });
          const isEdgeResilient = localActions.length > 0;
          const isFullyAutonomous = localActions.length === sceneActions.length && sceneActions.length > 0;
          const isProcessingThis = roomProcessing === `scene_${scene.id}`;

          return (
            <button
              key={scene.id}
              onClick={() => onSceneExecute(scene)}
              disabled={!!roomProcessing}
              className={cn(
                'group relative flex min-h-[8rem] items-stretch gap-5 overflow-hidden rounded-[2rem] border p-5 text-left transition-all duration-500 active:scale-95 disabled:opacity-50 hover:-translate-y-1 hover:shadow-xl',
                isProcessingThis
                  ? 'bg-primary border-primary text-primary-foreground shadow-2xl'
                  : 'bg-card/80 border-border shadow-depth-1 hover:border-primary/40',
                (isEdgeResilient && !isProcessingThis) && 'hover:border-success/30',
              )}
            >
              {isEdgeResilient && isProcessingThis && (
                <div className="absolute inset-0 bg-success/10 animate-atmospheric-glow pointer-events-none" />
              )}

              <div className={cn(
                'z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-700',
                isProcessingThis ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary',
                (isEdgeResilient && isProcessingThis) && 'bg-success shadow-lg shadow-success/40 scale-110',
              )}>
                {isEdgeResilient && isProcessingThis ? <Cpu className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="z-10 flex min-w-0 flex-1 flex-col justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1 flex items-center gap-2">
                  <h3 className="truncate text-base font-black tracking-tight">{scene.name}</h3>
                  {isEdgeResilient && (
                    <span className={cn(
                      'text-[7px] font-black uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-full border shrink-0',
                      isProcessingThis
                        ? 'bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground'
                        : 'bg-success/5 border-success/20 text-success/80',
                    )}>
                      {isFullyAutonomous ? t('dashboards.status.autonomous') : t('dashboards.status.edge')}
                    </span>
                  )}
                </div>
                <p className={cn(
                  'truncate text-[10px] font-medium italic opacity-60',
                  isProcessingThis ? 'text-primary-foreground' : 'text-muted-foreground',
                )}>
                  {isFullyAutonomous ? t('dashboards.status.hardware_execution') : (scene.description || t('dashboard.experience'))}
                </p>
                </div>

                <div className={cn(
                  'flex items-center justify-between rounded-full border px-3 py-2 text-[8px] font-black uppercase tracking-widest',
                  isProcessingThis
                    ? 'border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground/80'
                    : 'border-border/50 bg-background/25 text-muted-foreground',
                )}>
                  <span>{sceneActions.length} {t('dashboard.command_center.devices', { defaultValue: 'dispositivos' })}</span>
                  <span>{localActions.length} {t('dashboards.status.local')}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
