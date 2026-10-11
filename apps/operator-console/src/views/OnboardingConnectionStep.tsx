import { useTranslation } from 'react-i18next';
import { ExternalLink, KeyRound, Loader2, PlayCircle, Server, Wifi } from 'lucide-react';
import type { SetupStatus } from '../appShellTypes';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { Heading } from '../components/ui/Heading';
import { Input } from '../components/ui/Input';
import { StatusPill } from '../components/ui/StatusPill';
import { getRuntimeLabelKey } from './onboardingSetup';
import type { ConnectionTestResult } from './useOnboardingSetup';

interface OnboardingConnectionStepProps {
  statusProvider: SetupStatus;
  haUrl: string;
  haToken: string;
  loading: boolean;
  testingHA: boolean;
  testResult: ConnectionTestResult;
  canTestConnection: boolean;
  onUrlChange: (value: string) => void;
  onTokenChange: (value: string) => void;
  onTestConnection: () => void;
  onSaveConnection: () => void;
}

export function OnboardingConnectionStep({
  statusProvider,
  haUrl,
  haToken,
  loading,
  testingHA,
  testResult,
  canTestConnection,
  onUrlChange,
  onTokenChange,
  onTestConnection,
  onSaveConnection
}: OnboardingConnectionStepProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wifi className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <Heading variant="section" className="text-foreground">{t('onboarding.step2.title')}</Heading>
          <p className="hp-type-body mt-1">{t('onboarding.step2.description')}</p>
        </div>
      </div>

      <div className="grid gap-4">
        {(statusProvider.homeAssistantBridgeUrl || statusProvider.homeAssistantSetupUrl) && (
          <div className="grid gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="hp-type-label-accent">{t('onboarding.step2.runtime_title')}</p>
              <StatusPill variant="primary">{t(getRuntimeLabelKey(statusProvider.runtimeTarget))}</StatusPill>
            </div>
            {statusProvider.homeAssistantBridgeUrl && (
              <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                <p className="text-caption font-semibold text-foreground">{t('onboarding.step2.bridge_url_title')}</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <code className="min-w-0 break-all rounded-md bg-muted px-2 py-1 text-caption text-foreground">
                    {statusProvider.homeAssistantBridgeUrl}
                  </code>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="shrink-0 whitespace-normal"
                    onClick={() => onUrlChange(statusProvider.homeAssistantBridgeUrl ?? '')}
                  >
                    {t('onboarding.step2.use_bridge_url')}
                  </Button>
                </div>
                <p className="mt-2 text-caption text-muted-foreground">{t('onboarding.step2.bridge_url_hint')}</p>
              </div>
            )}
            {statusProvider.homeAssistantSetupUrl && (
              <div className="rounded-lg border border-border/60 bg-card/70 p-3">
                <p className="text-caption font-semibold text-foreground">{t('onboarding.step2.token_url_title')}</p>
                <p className="mt-1 break-all text-caption text-muted-foreground">{statusProvider.homeAssistantSetupUrl}</p>
                <a
                  href={statusProvider.homeAssistantSetupUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-caption font-semibold text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {t('onboarding.step2.open_home_assistant')}
                </a>
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          <Input
            type="url"
            label={t('onboarding.step2.url')}
            icon={<Server className="h-4 w-4" />}
            placeholder={statusProvider.homeAssistantBridgeUrl ?? t('onboarding.step2.url_placeholder')}
            value={haUrl}
            onChange={(event) => onUrlChange(event.target.value)}
          />
          <p className="text-caption font-semibold text-muted-foreground">{t('onboarding.step2.url_hint')}</p>
        </div>

        <div className="space-y-2">
          <Input
            type="password"
            label={t('onboarding.step2.token')}
            icon={<KeyRound className="h-4 w-4" />}
            placeholder={t('onboarding.step2.token_placeholder')}
            value={haToken}
            onChange={(event) => onTokenChange(event.target.value)}
          />
        </div>
      </div>

      <details className="border-t border-border py-3">
        <summary className="cursor-pointer text-body-compact font-medium">{t('onboarding.step2.token_help_title')}</summary>
        <ol className="mt-3 grid gap-2 text-body-compact text-muted-foreground">
          <li>{t('onboarding.step2.token_help_1')}</li>
          <li>{t('onboarding.step2.token_help_2')}</li>
          <li>{t('onboarding.step2.token_help_3')}</li>
        </ol>
      </details>

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button
          onClick={onTestConnection}
          disabled={!canTestConnection}
          variant="secondary"
          size="md"
          className="min-w-0 flex-1 whitespace-normal"
        >
          {testingHA ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
          {t('onboarding.step2.test')}
        </Button>

        <Button
          onClick={onSaveConnection}
          disabled={testResult !== 'success' || loading}
          size="md"
          className="min-w-0 flex-1 whitespace-normal"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {t('onboarding.step2.save')}
        </Button>
      </div>
      {testResult === 'success' && (
        <AlertBanner variant="success" size="sm" className="animate-in fade-in" message={t('onboarding.step2.success')} />
      )}
    </div>
  );
}
