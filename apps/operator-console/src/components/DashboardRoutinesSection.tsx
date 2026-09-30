import { Settings2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionActionCard } from '../views/dashboards/widgets/SectionActionCard';
import { Button } from './ui/Button';

interface RoutineScene {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  actions: { deviceId: string; command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop' }[];
}

export interface DashboardRoutineAutomation {
  id: string;
  name: string;
  icon?: string;
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
  actionFeedback: { id: string; status: 'success' | 'error' } | null;
  onSceneExecute: (scene: RoutineScene) => void;
  onAutomationExecute: (automation: DashboardRoutineAutomation) => void;
  onManage: () => void;
}

export function DashboardRoutinesSection({
  scenes,
  automations,
  favoriteSceneIds,
  favoriteAutomationIds,
  canManageAutomations,
  processingId,
  actionFeedback,
  onSceneExecute,
  onAutomationExecute,
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
    <section className="homepilot-home-routines animate-in fade-in slide-in-from-bottom-4 duration-500" data-demo="dashboard-routines">
      <div className="mb-3 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
        <div>
          <h2 className="text-body font-semibold tracking-tight text-foreground">{t('dashboard.favorite_routines')}</h2>
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-3" data-testid="favorite-routine-grid">
          {routines.map((routine) => {
            const key = `${routine.type}_${routine.value.id}`;
            const isProcessing = processingId === key;
            const feedback = isProcessing ? 'pending' : actionFeedback?.id === key ? actionFeedback.status : undefined;
            return (
              <div key={key} className="h-24 min-w-0" data-home-routine={routine.type}>
                <SectionActionCard
                  kind="action"
                  title={routine.value.name}
                  icon={routine.value.icon ?? (routine.type === 'scene' ? 'mdi:auto-fix' : 'mdi:robot')}
                  isAssigned
                  isActive={isProcessing || feedback === 'success'}
                  actionFeedback={feedback}
                  onAction={processingId === null ? () => {
                    if (routine.type === 'scene') onSceneExecute(routine.value);
                    else onAutomationExecute(routine.value);
                  } : undefined}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
