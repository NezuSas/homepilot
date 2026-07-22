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
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:gap-7 sm:pb-16">
      <section className="flex flex-col gap-4 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-micro font-semibold uppercase tracking-control text-primary">{t('routines.eyebrow')}</p>
          <h1 className="text-view-title font-semibold tracking-display-tight text-foreground">{t('routines.title')}</h1>
          <p className="max-w-xl text-body text-muted-foreground">{t('routines.description')}</p>
        </div>
        <SegmentedControl
          value={activeSection}
          options={options}
          onChange={onSectionChange}
          tone="primary"
          className="w-full shrink-0 gap-1 p-1 sm:w-[min(100%,23rem)]"
          optionClassName="min-h-9 min-w-0 gap-1 px-2 py-1.5 text-micro font-semibold leading-none tracking-normal [&>svg]:h-3.5 [&>svg]:w-3.5 [&>span]:overflow-hidden [&>span]:text-ellipsis [&>span]:whitespace-nowrap"
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
