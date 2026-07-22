import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  Home,
  KeyRound,
  Loader2,
  PlayCircle,
  Server,
  ShieldCheck,
  Wifi,
  XCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { cn } from '../lib/utils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface SetupStatus {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
  installationProfile: 'bridge_ha' | 'native_only' | 'ha_companion';
  requiresHomeAssistant: boolean;
}

interface OnboardingViewProps {
  onCompleted: () => void;
  statusProvider: SetupStatus | null;
  userContext: { username: string; role: string } | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function OnboardingView({ onCompleted, statusProvider, userContext }: OnboardingViewProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<number>(1);
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [testingHA, setTestingHA] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAdmin = userContext?.role === 'admin';
  const isNativeOnly = statusProvider?.installationProfile === 'native_only';
  const trimmedHaUrl = haUrl.trim();
  const trimmedHaToken = haToken.trim();
  const canTestConnection = trimmedHaUrl.length > 0 && trimmedHaToken.length > 0 && !testingHA && !loading;
  const progressItems = [
    { index: 1, label: t('onboarding.progress.diagnostics') },
    { index: 2, label: t(isNativeOnly ? 'onboarding.progress.native' : 'onboarding.progress.bridge') },
    { index: 3, label: t('onboarding.progress.activation') }
  ];
  const readinessItems = [
    {
      label: t('onboarding.step1.admin'),
      value: isAdmin ? `${t('onboarding.step1.ok')} (${userContext?.username})` : t('onboarding.step1.missing'),
      status: isAdmin ? 'success' : 'error'
    },
    ...(!isNativeOnly ? [
      {
        label: t('onboarding.step1.ha_config'),
        value: statusProvider?.hasHAConfig ? t('onboarding.step1.config_present') : t('onboarding.step1.config_missing'),
        status: statusProvider?.hasHAConfig ? 'success' : 'warning'
      },
      {
        label: t('onboarding.step1.connection'),
        value: statusProvider?.haConnectionValid ? t('onboarding.step1.valid') : t('onboarding.step1.unknown'),
        status: statusProvider?.haConnectionValid ? 'success' : 'warning'
      }
    ] : [])
  ];

  const handleTestConnection = async () => {
    setTestingHA(true);
    setTestResult('idle');
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/settings/test-ha-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: trimmedHaUrl, accessToken: trimmedHaToken })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        const msg = data.error?.message || (typeof data.error === 'string' ? data.error : t('ha_settings.status_card.error'));
        setErrorMsg(msg);
      }
    } catch (e: unknown) {
      setTestResult('error');
      setErrorMsg(getErrorMessage(e, t('ha_settings.status_card.error')));
    } finally {
      setTestingHA(false);
    }
  };

  const handleSaveConnection = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/settings/home-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: trimmedHaUrl, accessToken: trimmedHaToken })
      });
      if (!res.ok) throw new Error(t('onboarding.error_save'));
      setStep(3);
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e, t('onboarding.error_save')));
    } finally {
      setLoading(false);
    }
  };

  const finalizeSetup = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/system/setup-status/complete`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : t('onboarding.error_complete'));
        throw new Error(msg);
      }
      
      onCompleted();
    } catch (e: unknown) {
      setErrorMsg(getErrorMessage(e, t('onboarding.error_complete')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 min-h-onboarding bg-muted/20 px-4 py-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        
        <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <Home className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="hp-type-label-accent">{t('onboarding.kicker')}</p>
                <h1 className="mt-1 text-view-title font-bold tracking-tight text-foreground">{t('onboarding.title')}</h1>
                <p className="hp-type-body mt-1 max-w-2xl">
                  {t('onboarding.subtitle')}
                </p>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-2 sm:max-w-form-md lg:w-form-md">
              {progressItems.map(item => {
                const isCurrent = item.index === step;
                const isDone = item.index < step;
                return (
                  <div
                    key={item.index}
                    className={cn(
                      'min-w-0 rounded-xl border px-2 py-2 text-nano font-semibold uppercase leading-tight tracking-[0.04em] transition-colors sm:px-2.5',
                      isCurrent && 'border-primary/60 bg-primary/10 text-primary',
                      isDone && 'border-success/30 bg-success/10 text-success',
                      !isCurrent && !isDone && 'border-border/60 bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <span className="mb-1 block text-nano font-semibold tracking-normal opacity-70">{t('onboarding.progress.step', { count: item.index })}</span>
                    <span className="block whitespace-nowrap text-nano leading-3">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-body-compact font-medium">{errorMsg}</span>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
          <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
            {step === 1 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-section-title font-bold tracking-tight">{t('onboarding.step1.title')}</h2>
                    <p className="hp-type-body mt-1">{t('onboarding.step1.description')}</p>
                  </div>
                </div>
                
                <div className="grid gap-3">
                  {readinessItems.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-muted/25 px-4 py-3">
                      <span className="text-body-compact font-semibold text-muted-foreground">{item.label}</span>
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 text-right text-micro font-semibold uppercase tracking-control',
                          item.status === 'success' && 'text-success',
                          item.status === 'warning' && 'text-warning',
                          item.status === 'error' && 'text-danger'
                        )}
                      >
                        {item.status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="hp-type-label-accent">{t('onboarding.step1.operator_note_title')}</p>
                  <p className="hp-type-body mt-2">{t(isNativeOnly ? 'onboarding.step1.native_operator_note' : 'onboarding.step1.operator_note')}</p>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setStep(isNativeOnly ? 3 : 2)}
                    disabled={!isAdmin}
                    size="md"
                    className="w-full uppercase tracking-label sm:w-auto"
                  >
                    {t(isNativeOnly ? 'onboarding.step1.native_continue' : 'onboarding.step1.continue')}
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Wifi className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-section-title font-bold tracking-tight">{t('onboarding.step2.title')}</h2>
                    <p className="hp-type-body mt-1">{t('onboarding.step2.description')}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Input
                      type="url"
                      label={t('onboarding.step2.url')}
                      icon={<Server className="h-4 w-4" />}
                      placeholder={t('onboarding.step2.url_placeholder')}
                      value={haUrl}
                      onChange={(event) => {
                        setHaUrl(event.target.value);
                        setTestResult('idle');
                      }}
                    />
                    <p className="text-caption font-semibold text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('onboarding.step2.docker_hint') }} />
                  </div>

                  <div className="space-y-2">
                    <Input
                      type="password"
                      label={t('onboarding.step2.token')}
                      icon={<KeyRound className="h-4 w-4" />}
                      placeholder={t('onboarding.step2.token_placeholder')}
                      value={haToken}
                      onChange={(event) => {
                        setHaToken(event.target.value);
                        setTestResult('idle');
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                  <p className="hp-type-label">{t('onboarding.step2.token_help_title')}</p>
                  <ol className="mt-3 grid gap-2 text-body-compact text-muted-foreground">
                    <li>{t('onboarding.step2.token_help_1')}</li>
                    <li>{t('onboarding.step2.token_help_2')}</li>
                    <li>{t('onboarding.step2.token_help_3')}</li>
                  </ol>
                </div>

                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Button
                    onClick={handleTestConnection}
                    disabled={!canTestConnection}
                    variant="secondary"
                    size="md"
                    className="flex-1 uppercase tracking-label"
                  >
                    {testingHA ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                    {t('onboarding.step2.test')}
                  </Button>
                  
                  <Button
                    onClick={handleSaveConnection}
                    disabled={testResult !== 'success' || loading}
                    size="md"
                    className="flex-[1.35] uppercase tracking-label"
                  >
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {t('onboarding.step2.save')}
                  </Button>
                </div>
                {testResult === 'success' && (
                  <p className="animate-in fade-in rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-center text-body-compact font-semibold text-success">{t('onboarding.step2.success')}</p>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 text-center animate-in zoom-in-95">
                <div className="w-16 h-16 bg-success/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-success/20">
                  <CheckCircle2 className="w-8 h-8 text-success" />
                </div>
                <div>
                  <p className="hp-type-label-accent text-success">{t(isNativeOnly ? 'onboarding.step3.native_kicker' : 'onboarding.step3.kicker')}</p>
                  <h2 className="mt-2 text-view-title font-bold tracking-tight">{t('onboarding.step3.title')}</h2>
                  <p className="hp-type-body mx-auto mt-2 max-w-lg">
                    {t(isNativeOnly ? 'onboarding.step3.native_subtitle' : 'onboarding.step3.subtitle')}
                  </p>
                </div>

                <div className="grid gap-3 text-left sm:grid-cols-3">
                  {[
                    t(isNativeOnly ? 'onboarding.step3.native_next_1' : 'onboarding.step3.next_1'),
                    t('onboarding.step3.next_2'),
                    t(isNativeOnly ? 'onboarding.step3.native_next_3' : 'onboarding.step3.next_3')
                  ].map(item => (
                    <div key={item} className="rounded-xl border border-border/70 bg-muted/25 p-4 text-micro font-semibold uppercase tracking-control text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>

                <div className="pt-2">
                  <Button
                    onClick={finalizeSetup}
                    disabled={loading}
                    size="md"
                    className="w-full bg-success uppercase tracking-label text-success-foreground hover:bg-success/90 sm:w-auto"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.step3.complete')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <p className="hp-type-label">{t('onboarding.side.title')}</p>
            <div className="mt-4 grid gap-3">
              {[
                t('onboarding.side.local'),
                t(isNativeOnly ? 'onboarding.side.native_secure' : 'onboarding.side.secure'),
                t(isNativeOnly ? 'onboarding.side.native_recoverable' : 'onboarding.side.recoverable')
              ].map(item => (
                <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/25 p-3">
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
