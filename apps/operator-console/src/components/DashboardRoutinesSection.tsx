import { Clock3, Settings2, Sparkles, Star, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';

interface RoutineScene {
  id: string;
  name: string;
  description?: string;
  actions: { deviceId: string; command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop' }[];
}

export interface DashboardRoutineAutomation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { type: 'device_state_changed' | 'time'; time?: string; timeLocal?: string };
}

interface DashboardRoutinesSectionProps {
  scenes: RoutineScene[];
  automations: DashboardRoutineAutomation[];
  favoriteSceneIds: string[];
  favoriteAutomationIds: string[];
  canManageAutomations: boolean;
  processingId: string | null;
  onSceneExecute: (scene: RoutineScene) => void;
  onAutomationToggle: (automation: DashboardRoutineAutomation) => void;
  onManage: () => void;
}

export function DashboardRoutinesSection({
  scenes,
  automations,
  favoriteSceneIds,
  favoriteAutomationIds,
  canManageAutomations,
  processingId,
  onSceneExecute,
  onAutomationToggle,
  onManage,
}: DashboardRoutinesSectionProps) {
  const { t } = useTranslation();
  const favoriteScenes = scenes.filter((scene) => favoriteSceneIds.includes(scene.id));
  const favoriteAutomations = canManageAutomations
    ? automations.filter((automation) => favoriteAutomationIds.includes(automation.id))
    : [];
  const routines = [
    ...favoriteScenes.map((scene) => ({ type: 'scene' as const, value: scene })),
    ...favoriteAutomations.map((automation) => ({ type: 'automation' as const, value: automation })),
  ];

  return (
    <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" data-demo="dashboard-routines">
      <div className="mb-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div>
          <h2 className="text-section-title font-semibold tracking-tight text-foreground">{t('dashboard.favorite_routines')}</h2>
          <p className="text-caption text-muted-foreground">{t('dashboard.favorite_routines_hint')}</p>
        </div>
        <Button variant="ghost" onClick={onManage} className="h-auto gap-2 self-start px-0 text-caption font-semibold text-primary min-[420px]:self-auto">
          <Settings2 className="h-3.5 w-3.5" />
          {t('dashboard.manage_routines')}
        </Button>
      </div>

      {routines.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-panel border border-dashed border-border/60 bg-card/35 px-6 py-10 text-center">
          <Star className="mb-3 h-8 w-8 text-primary/40" />
          <p className="text-body font-semibold text-foreground">{t('dashboard.no_favorite_routines')}</p>
          <p className="mt-1 max-w-md text-caption text-muted-foreground">{t('dashboard.no_favorite_routines_hint')}</p>
          <Button variant="ghost" size="sm" onClick={onManage} className="mt-3 text-caption font-semibold text-primary">
            {t('dashboard.manage_routines')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
          {routines.map((routine) => {
            if (routine.type === 'scene') {
              const isProcessing = processingId === `scene_${routine.value.id}`;
              return (
                <Button
                  key={`scene_${routine.value.id}`}
                  type="button"
                  variant="ghost"
                  size="md"
                  onClick={() => onSceneExecute(routine.value)}
                  disabled={processingId !== null}
                  className={cn(
                    'group relative flex min-h-28 w-full items-center justify-start gap-3 rounded-card border bg-card p-4 text-left shadow-depth-1 surface-transition active:scale-[0.98] disabled:opacity-60',
                    isProcessing ? 'border-primary bg-primary text-primary-foreground shadow-depth-2' : 'border-border/65 hover:border-primary/35',
                  )}
                >
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border', isProcessing ? 'border-primary-foreground/20 bg-primary-foreground/15' : 'border-primary/15 bg-primary/10 text-primary')}>
                    <Sparkles className={cn('h-5 w-5', isProcessing && 'animate-pulse')} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('mb-1 inline-flex rounded-pill border px-2 py-0.5 text-micro font-semibold uppercase tracking-control', isProcessing ? 'border-primary-foreground/20 text-primary-foreground/75' : 'border-primary/20 bg-primary/5 text-primary')}>
                      {t('dashboard.routine_manual')}
                    </span>
                    <span className="block truncate text-card-title font-semibold tracking-tight">{routine.value.name}</span>
                    <span className={cn('mt-1 block truncate text-caption', isProcessing ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                      {routine.value.description || t('dashboard.routine_scene_actions', { count: routine.value.actions.length })}
                    </span>
                  </span>
                </Button>
              );
            }

            const isProcessing = processingId === routine.value.id;
            const TriggerIcon = routine.value.trigger.type === 'time' ? Clock3 : Zap;
            return (
              <Button
                key={`automation_${routine.value.id}`}
                type="button"
                variant="ghost"
                size="md"
                onClick={() => onAutomationToggle(routine.value)}
                disabled={processingId !== null}
                className={cn(
                  'group relative flex min-h-28 w-full items-center justify-start gap-3 rounded-card border bg-card p-4 text-left shadow-depth-1 surface-transition active:scale-[0.98] disabled:opacity-60',
                  routine.value.enabled ? 'border-primary/35 hover:border-primary/55' : 'border-border/65 hover:border-primary/35',
                )}
              >
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-pill border', routine.value.enabled ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground')}>
                  <TriggerIcon className={cn('h-5 w-5', isProcessing && 'animate-pulse')} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 inline-flex rounded-pill border border-border/70 bg-muted/45 px-2 py-0.5 text-micro font-semibold uppercase tracking-control text-muted-foreground">
                    {t('dashboard.routine_automatic')}
                  </span>
                  <span className="block truncate text-card-title font-semibold tracking-tight text-foreground">{routine.value.name}</span>
                  <span className={cn('mt-1 block text-caption', routine.value.enabled ? 'text-primary' : 'text-muted-foreground')}>
                    {routine.value.enabled ? t('automations.summary.active') : t('automations.summary.paused')}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
