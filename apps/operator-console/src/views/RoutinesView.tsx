import { LayoutGrid, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import AutomationsView from './AutomationsView';
import ScenesView from './ScenesView';

export type RoutineSection = 'scenes' | 'automations';

interface RoutinesViewProps {
  section: RoutineSection;
  canManageAutomations: boolean;
  onSectionChange: (section: RoutineSection) => void;
  onSceneActionExecute: (label: string) => void;
}

export default function RoutinesView({
  section,
  canManageAutomations,
  onSectionChange,
  onSceneActionExecute,
}: RoutinesViewProps) {
  const { t } = useTranslation();
  const activeSection = canManageAutomations ? section : 'scenes';
  const options = [
    { value: 'scenes' as const, label: t('routines.scenes_tab'), icon: LayoutGrid },
    ...(canManageAutomations
      ? [{ value: 'automations' as const, label: t('routines.automations_tab'), icon: Workflow }]
      : []),
  ];

  return (
    <div className="flex flex-col gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="flex flex-col gap-4 rounded-panel border border-border/70 bg-card/65 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-micro font-semibold uppercase tracking-control text-primary">{t('routines.eyebrow')}</p>
          <h1 className="text-section-title font-bold tracking-tight text-foreground">{t('routines.title')}</h1>
          <p className="max-w-2xl text-body text-muted-foreground">{t('routines.description')}</p>
        </div>
        <SegmentedControl
          value={activeSection}
          options={options}
          onChange={onSectionChange}
          tone="primary"
          className="w-full shrink-0 sm:w-[min(100%,22rem)]"
        />
      </section>

      {activeSection === 'scenes' ? (
        <ScenesView onActionExecute={onSceneActionExecute} />
      ) : (
        <AutomationsView />
      )}
    </div>
  );
}
