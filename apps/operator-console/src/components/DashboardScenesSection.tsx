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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                'group relative flex items-center gap-6 p-6 rounded-[2.5rem] transition-all duration-500 text-left overflow-hidden border-2 active:scale-95 disabled:opacity-50 hover:-translate-y-1 hover:shadow-xl',
                isProcessingThis
                  ? 'bg-primary border-primary text-primary-foreground shadow-2xl'
                  : 'bg-card border-border shadow-md hover:border-primary/40',
                (isEdgeResilient && !isProcessingThis) && 'hover:border-success/30',
              )}
            >
              {isEdgeResilient && isProcessingThis && (
                <div className="absolute inset-0 bg-success/10 animate-atmospheric-glow pointer-events-none" />
              )}

              <div className={cn(
                'p-4 rounded-2xl transition-all duration-700 z-10',
                isProcessingThis ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-primary',
                (isEdgeResilient && isProcessingThis) && 'bg-success shadow-lg shadow-success/40 scale-110',
              )}>
                {isEdgeResilient && isProcessingThis ? <Cpu className="w-5 h-5 animate-pulse" /> : <Zap className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1 z-10">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-base font-black tracking-tight truncate">{scene.name}</h3>
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
                  'text-[10px] font-medium italic opacity-60 truncate',
                  isProcessingThis ? 'text-primary-foreground' : 'text-muted-foreground',
                )}>
                  {isFullyAutonomous ? t('dashboards.status.hardware_execution') : (scene.description || t('dashboard.experience'))}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
