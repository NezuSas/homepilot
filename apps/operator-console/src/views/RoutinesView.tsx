import { LayoutGrid, Workflow } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { SectionHeader } from '../components/ui/SectionHeader';
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
    <div className="flex flex-col gap-6 pb-8 sm:gap-8 sm:pb-10">
      <SectionHeader
        level="view"
        title={t('routines.title')}
        subtitle={t('routines.description')}
        action={
          <SegmentedControl
            value={activeSection}
            options={options}
            onChange={onSectionChange}
            label={t('routines.title')}
            tone="primary"
            layout="scroll"
            className="h-11 w-fit max-w-full shrink-0 items-center gap-1 overflow-y-hidden border-border/60 bg-card p-1"
            optionClassName="h-9 min-h-0 gap-1.5 px-3 py-0 text-caption font-semibold leading-none tracking-normal [&>svg]:h-3.5 [&>svg]:w-3.5"
          />
        }
      />

      {activeSection === 'scenes' ? (
        <ScenesView onActionExecute={onSceneActionExecute} />
      ) : (
        <AutomationsView />
      )}
    </div>
  );
}