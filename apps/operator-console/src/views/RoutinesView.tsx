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
  currentUserId: string | null;
}

export default function RoutinesView({
  section,
  canManageAutomations,
  onSectionChange,
  onSceneActionExecute,
  currentUserId,
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
    <div className="flex flex-col gap-4 pb-8 sm:gap-5 sm:pb-10">
      <SectionHeader
        level="view"
        className="mb-0"
        icon={Workflow}
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
            className="w-fit max-w-full shrink-0"
          />
        }
      />

      {activeSection === 'scenes' ? (
        <ScenesView onActionExecute={onSceneActionExecute} currentUserId={currentUserId} />
      ) : (
        <AutomationsView currentUserId={currentUserId} />
      )}
    </div>
  );
}
