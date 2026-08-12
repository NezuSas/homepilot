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
    <div className="flex flex-col gap-5 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:gap-6 sm:pb-10">
      <section className="flex flex-col gap-3 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-micro font-semibold uppercase tracking-control text-primary">{t('routines.eyebrow')}</p>
          <h1 className="text-section-title font-semibold tracking-tight text-foreground">{t('routines.title')}</h1>
          <p className="max-w-xl text-caption text-muted-foreground">{t('routines.description')}</p>
        </div>
        <SegmentedControl
          value={activeSection}
          options={options}
          onChange={onSectionChange}
          label={t('routines.title')}
          tone="primary"
          layout="scroll"
          className="h-11 w-fit max-w-full shrink-0 items-center gap-1 overflow-y-hidden border-border/60 bg-card/60 p-1"
          optionClassName="h-8 min-h-0 gap-1 px-2.5 py-0 text-micro font-semibold leading-none tracking-normal [&>svg]:h-3.5 [&>svg]:w-3.5"
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
