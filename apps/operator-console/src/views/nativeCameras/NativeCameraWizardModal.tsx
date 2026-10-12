import { useTranslation } from 'react-i18next';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { cn } from '../../lib/utils';
import type { SnapshotHome } from '../../stores/useDeviceSnapshotStore';
import { WizardChooseStep } from './WizardChooseStep';
import { WizardDetailsStep } from './WizardDetailsStep';
import { WizardTestStep } from './WizardTestStep';
import type { NativeCameraWizard, WizardStep } from './useNativeCameraWizard';

const STEPS: readonly WizardStep[] = ['choose', 'details', 'test'];

function StepIndicator({ current }: { current: WizardStep }) {
  const { t } = useTranslation();
  const index = STEPS.indexOf(current);
  return (
    <ol className="flex items-center gap-2 text-caption font-semibold" aria-label={t('native_cameras.wizard.steps_label')}>
      {STEPS.map((step, position) => (
        <li key={step} aria-current={step === current ? 'step' : undefined} className={cn('flex items-center gap-2', position <= index ? 'text-foreground' : 'text-muted-foreground')}>
          <span className={cn('flex h-6 w-6 items-center justify-center rounded-full border text-caption', position <= index ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{position + 1}</span>
          {t(`native_cameras.wizard.steps.${step}`)}
          {position < STEPS.length - 1 && <span aria-hidden="true" className="h-px w-4 bg-border" />}
        </li>
      ))}
    </ol>
  );
}

function Footer({ wizard }: { wizard: NativeCameraWizard }) {
  const { t } = useTranslation();
  const outcome = wizard.test?.status === 'done' ? wizard.test.outcome : null;
  if (wizard.step === 'choose') {
    return <Button variant="secondary" onClick={wizard.close}>{t('common.cancel')}</Button>;
  }
  if (wizard.step === 'details') {
    return (
      <>
        <Button variant="secondary" onClick={wizard.backToChoose}>{t('native_cameras.wizard.back')}</Button>
        <Button variant="primary" onClick={wizard.submitDetails}>{t('native_cameras.wizard.test_button')}</Button>
      </>
    );
  }
  if (!outcome) return <Button variant="secondary" onClick={wizard.backToDetails}>{t('common.cancel')}</Button>;
  return (
    <>
      <Button variant="secondary" onClick={wizard.backToDetails} disabled={wizard.isSaving}>{t('native_cameras.wizard.back_to_details')}</Button>
      {outcome.ok ? (
        <Button variant="primary" onClick={wizard.save} isLoading={wizard.isSaving}>{t('native_cameras.wizard.save_ok')}</Button>
      ) : (
        <>
          <Button variant="ghost" onClick={wizard.save} isLoading={wizard.isSaving}>{t('native_cameras.wizard.save_anyway')}</Button>
          <Button variant="primary" onClick={wizard.runTest} disabled={wizard.isSaving}>{t('native_cameras.wizard.retry')}</Button>
        </>
      )}
    </>
  );
}

export function NativeCameraWizardModal({ wizard, homes }: { wizard: NativeCameraWizard; homes: SnapshotHome[] }) {
  const { t } = useTranslation();
  return (
    <Modal
      isOpen={wizard.isOpen}
      onClose={wizard.close}
      title={t('native_cameras.wizard.title')}
      description={t(`native_cameras.wizard.subtitles.${wizard.step}`)}
      className="max-w-2xl"
      headerAlign="start"
      headerClassName="p-4 pb-3 pr-14 sm:p-5 sm:pb-3 sm:pr-14"
      contentClassName="px-4 pb-4 sm:px-5 sm:pb-5"
    >
      <div className="space-y-4">
        <StepIndicator current={wizard.step} />
        {wizard.step === 'choose' && <WizardChooseStep wizard={wizard} />}
        {wizard.step === 'details' && <WizardDetailsStep wizard={wizard} homes={homes} />}
        {wizard.step === 'test' && <WizardTestStep wizard={wizard} />}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border/40 pt-3">
          <Footer wizard={wizard} />
        </div>
      </div>
    </Modal>
  );
}
