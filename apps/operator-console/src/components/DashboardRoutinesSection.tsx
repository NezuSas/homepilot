import { Settings2, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SectionActionCard } from '../views/dashboards/widgets/SectionActionCard';
import { Button } from './ui/Button';
import { EmptyState } from './ui/EmptyState';
import { Heading } from './ui/Heading';

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
          <Heading variant="item" as="h2">{t('dashboard.favorite_routines')}</Heading>
          <p className="text-caption text-muted-foreground">{t('dashboard.favorite_routines_hint')}</p>
        </div>
        <Button variant="ghost" onClick={onManage} className="self-start min-[420px]:self-auto">
          <Settings2 className="h-3.5 w-3.5" />
          {t('dashboard.manage_routines')}
        </Button>
      </div>

      {routines.length === 0 ? (
        <EmptyState
          variant="dashed"
          icon={Star}
          title={t('dashboard.no_favorite_routines')}
          description={t('dashboard.no_favorite_routines_hint')}
          action={(
            <Button variant="ghost" size="sm" onClick={onManage}>
              {t('dashboard.manage_routines')}
            </Button>
          )}
        />
      ) : (
        <div className="flex flex-wrap gap-3" data-testid="favorite-routine-grid">
          {routines.map((routine) => {
            const key = `${routine.type}_${routine.value.id}`;
            const isProcessing = processingId === key;
            const feedback = isProcessing ? 'pending' : actionFeedback?.id === key ? actionFeedback.status : undefined;
            return (
              <div
                key={key}
                className={`group/card relative grid h-24 w-36 max-w-full min-w-0 overflow-hidden rounded-section border border-transparent shadow-sm transition-[border-color,background-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-depth-2 active:scale-[0.985] ${isProcessing || feedback === 'success' ? 'homepilot-section-light-tile-active' : ''}`}
                data-home-routine={routine.type}
              >
                <SectionActionCard
                  kind="action"
                  title={routine.value.name}
                  icon={routine.value.icon ?? (routine.type === 'scene' ? 'mdi:auto-fix' : 'mdi:robot')}
                  isAssigned
                  isActive={isProcessing || feedback === 'success'}
                  actionFeedback={feedback}
                  isBlocked={processingId !== null}
                  onAction={() => {
                    if (routine.type === 'scene') onSceneExecute(routine.value);
                    else onAutomationExecute(routine.value);
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
