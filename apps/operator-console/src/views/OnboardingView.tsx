import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import type { SetupStatus } from '../appShellTypes';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Card } from '../components/ui/Card';
import { OnboardingSkeleton } from '../components/ui/ComponentSkeletons';
import { Heading } from '../components/ui/Heading';
import { buildReadinessItems } from './onboardingSetup';
import { OnboardingActivationStep } from './OnboardingActivationStep';
import { OnboardingConnectionStep } from './OnboardingConnectionStep';
import { OnboardingHeader } from './OnboardingHeader';
import { OnboardingReadinessStep } from './OnboardingReadinessStep';
import { useOnboardingSetup } from './useOnboardingSetup';

interface OnboardingViewProps {
  onCompleted: () => void;
  statusProvider: SetupStatus | null;
  userContext: { username: string; role: string } | null;
}

export function OnboardingView({ onCompleted, statusProvider, userContext }: OnboardingViewProps) {
  const { t } = useTranslation();
  const setup = useOnboardingSetup(onCompleted);
  const { step, errorMsg } = setup;

  const isAdmin = userContext?.role === 'admin';
  const isNativeOnly = statusProvider?.installationProfile === 'native_only';
  const readinessItems = buildReadinessItems(statusProvider, isAdmin, isNativeOnly, userContext?.username);

  if (!statusProvider) return <OnboardingSkeleton label={t('common.loading')} />;

  return (
    <div className="min-w-0 flex-1">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">

        <OnboardingHeader step={step} isNativeOnly={isNativeOnly} />

        {errorMsg && <AlertBanner variant="danger" size="sm" message={errorMsg} />}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
          <Card variant="flat" radius="section" className="p-4">
            {step === 1 && (
              <OnboardingReadinessStep
                readinessItems={readinessItems}
                isNativeOnly={isNativeOnly}
                isAdmin={isAdmin}
                onContinue={() => setup.setStep(isNativeOnly ? 3 : 2)}
              />
            )}

            {step === 2 && (
              <OnboardingConnectionStep
                statusProvider={statusProvider}
                haUrl={setup.haUrl}
                haToken={setup.haToken}
                loading={setup.loading}
                testingHA={setup.testingHA}
                testResult={setup.testResult}
                canTestConnection={setup.canTestConnection}
                onUrlChange={setup.changeHaUrl}
                onTokenChange={setup.changeHaToken}
                onTestConnection={setup.handleTestConnection}
                onSaveConnection={setup.handleSaveConnection}
              />
            )}

            {step === 3 && (
              <OnboardingActivationStep
                isNativeOnly={isNativeOnly}
                loading={setup.loading}
                onFinalize={setup.finalizeSetup}
              />
            )}
          </Card>

          <aside className="min-w-0 p-3">
            <Heading variant="item" as="h2">{t('onboarding.side.title')}</Heading>
            <div className="mt-4 grid gap-3">
              {[
                t('onboarding.side.local'),
                t(isNativeOnly ? 'onboarding.side.native_secure' : 'onboarding.side.secure'),
                t(isNativeOnly ? 'onboarding.side.native_recoverable' : 'onboarding.side.recoverable')
              ].map(item => (
                <div key={item} className="flex items-start gap-2 py-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span className="text-body-compact text-muted-foreground">{item}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
