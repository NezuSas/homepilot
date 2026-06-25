import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Sparkles } from 'lucide-react';
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
      <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border/60 bg-card/35 px-6 py-10 text-center" data-demo="dashboard-scenes">
        <Sparkles className="mb-3 h-8 w-8 text-primary/40" />
        <p className="text-body font-semibold text-muted-foreground">{t('scenes.empty_title')}</p>
        <Button variant="ghost" size="sm" onClick={onCreateScene} className="mt-3 text-caption font-semibold text-primary">
          {t('dashboard.scene_create')}
        </Button>
      </div>
    );
  }

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" data-demo="dashboard-scenes">
      <div className="mb-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <h2 className="text-section-title font-semibold tracking-tight text-foreground">
          {t('dashboard.quick_scenes', { defaultValue: 'Escenas rápidas' })}
        </h2>
        <Button variant="ghost" onClick={onCreateScene} className="group h-auto gap-2 px-0 text-caption font-semibold text-primary">
          <Plus className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-90" />
          {t('dashboard.new_scene')}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {scenes.map((scene) => {
          const sceneActions = scene.actions || [];
          const localActionCount = sceneActions.filter((action) => allDevices.find((device) => device.id === action.deviceId)?.integrationSource === 'sonoff').length;
          const isProcessing = roomProcessing === `scene_${scene.id}`;

          return (
            <button
              key={scene.id}
              onClick={() => onSceneExecute(scene)}
              disabled={!!roomProcessing}
              className={cn(
                'group relative flex min-h-[5.75rem] items-center gap-3 overflow-hidden rounded-card border p-3 text-left surface-transition interactive-lift active:scale-[0.98] disabled:opacity-50 sm:min-h-[6.5rem] sm:gap-4 sm:p-4',
                isProcessing ? 'border-primary bg-primary text-primary-foreground shadow-depth-2' : 'border-border/65 bg-card shadow-depth-1 hover:border-primary/35',
              )}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-pill border surface-transition sm:h-11 sm:w-11', isProcessing ? 'border-primary-foreground/20 bg-primary-foreground/15' : 'border-primary/15 bg-primary/10 text-primary')}>
                <Sparkles className={cn('h-5 w-5', isProcessing && 'animate-pulse')} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-card-title font-semibold tracking-tight">{scene.name}</span>
                <span className={cn('mt-1 block truncate text-caption', isProcessing ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                  {scene.description || `${sceneActions.length} ${t('dashboard.command_center.devices', { defaultValue: 'dispositivos' })}`}
                </span>
                {localActionCount > 0 && <span className={cn('mt-1.5 block text-micro font-semibold', isProcessing ? 'text-primary-foreground/70' : 'text-success')}>{t('dashboards.status.local')}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
