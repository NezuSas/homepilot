import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { AlertBanner } from '../../components/ui/AlertBanner';
import type { NativeCameraWizard } from './useNativeCameraWizard';

export function WizardTestStep({ wizard }: { wizard: NativeCameraWizard }) {
  const { t } = useTranslation();
  const { test, form } = wizard;

  if (!test || test.status === 'running') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-10 text-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-primary motion-reduce:animate-none" />
        <p className="text-body font-semibold">{t('native_cameras.wizard.testing_title', { name: form.name || form.host })}</p>
        <p className="max-w-sm text-body-compact text-muted-foreground">{t('native_cameras.wizard.testing_hint')}</p>
      </div>
    );
  }

  const { outcome } = test;
  return (
    <div className="space-y-3">
      {outcome.ok ? (
        <>
          <img
            src={outcome.snapshot}
            alt={t('native_cameras.wizard.preview_alt', { name: form.name || form.host })}
            className="aspect-video w-full rounded-card border border-border bg-muted object-contain"
          />
          <AlertBanner
            variant="success"
            size="sm"
            message={t('native_cameras.wizard.test_ok', {
              details: [outcome.width && outcome.height ? `${outcome.width}×${outcome.height}` : null, outcome.codec?.toUpperCase() ?? null]
                .filter(Boolean).join(' · ') || t('native_cameras.wizard.test_ok_no_details'),
            })}
          />
          {outcome.ptzSupported && <p className="text-body-compact text-muted-foreground">{t('native_cameras.wizard.test_ptz')}</p>}
        </>
      ) : (
        <AlertBanner variant="danger" title={outcome.message ?? t('native_cameras.wizard.test_request_failed')} message={outcome.hint ?? t('native_cameras.wizard.test_request_failed_hint')} />
      )}
      {wizard.saveError && <AlertBanner variant="danger" size="sm" message={wizard.saveError} />}
    </div>
  );
}
