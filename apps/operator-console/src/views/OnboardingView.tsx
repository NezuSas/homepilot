import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, Server, KeyRound, Loader2, PlayCircle, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface SetupStatus {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
}

interface OnboardingViewProps {
  onCompleted: () => void;
  statusProvider: SetupStatus | null;
  userContext: { username: string; role: string } | null;
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

  // Pasos de Diagnóstico
  const isAdmin = userContext?.role === 'admin';

  const handleTestConnection = async () => {
    setTestingHA(true);
    setTestResult('idle');
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/test-ha-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: haUrl, accessToken: haToken })
      });
      const data = await res.json();
      if (data.success) {
        setTestResult('success');
      } else {
        setTestResult('error');
        const msg = data.error?.message || (typeof data.error === 'string' ? data.error : t('ha_settings.status_card.error'));
        setErrorMsg(msg);
      }
    } catch (e: any) {
      setTestResult('error');
      setErrorMsg(e.message);
    } finally {
      setTestingHA(false);
    }
  };

  const handleSaveConnection = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/settings/home-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: haUrl, accessToken: haToken })
      });
      if (!res.ok) throw new Error(t('onboarding.error_save'));
      setStep(3);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const finalizeSetup = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/system/setup-status/complete`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : t('onboarding.error_complete'));
        throw new Error(msg);
      }
      
      onCompleted();
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 bg-muted/20">
      <div className="max-w-xl w-full bg-card shadow-sm border rounded-xl overflow-hidden p-8">
        
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Home className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t('onboarding.title')}</h1>
          <p className="text-muted-foreground mt-1 text-center">
            {t('onboarding.subtitle')}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-danger/10 border border-danger/50 p-4 rounded-lg flex items-start gap-3 text-danger">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Diagnostic Matrix */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">1</span>
              {t('onboarding.step1.title')}
            </h2>
            
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border text-sm">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">{t('onboarding.step1.admin')}</span>
                {isAdmin ? <span className="text-success font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {t('onboarding.step1.ok')} ({userContext?.username})</span> : <span className="text-danger font-medium">{t('onboarding.step1.missing')}</span>}
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">{t('onboarding.step1.ha_config')}</span>
                {statusProvider?.hasHAConfig ? <span className="text-success font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> {t('onboarding.step1.config_present')}</span> : <span className="text-warning font-medium">{t('onboarding.step1.config_missing')}</span>}
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('onboarding.step1.connection')}</span>
                <span className={statusProvider?.haConnectionValid ? 'text-success font-medium' : 'text-warning font-medium'}>
                  {statusProvider?.haConnectionValid ? t('onboarding.step1.valid') : t('onboarding.step1.unknown')}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={() => setStep(2)}
                disabled={!isAdmin}
                className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50"
              >
                {t('onboarding.step1.continue')}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: HA Integration */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">2</span>
              {t('onboarding.step2.title')}
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('onboarding.step2.url')}</label>
                <div className="relative">
                  <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder={t('onboarding.step2.url_placeholder')}
                    value={haUrl}
                    onChange={(e) => setHaUrl(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
                <p className="text-xs text-muted-foreground" dangerouslySetInnerHTML={{ __html: t('onboarding.step2.docker_hint') }} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">{t('onboarding.step2.token')}</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder={t('onboarding.step2.token_placeholder')}
                    value={haToken}
                    onChange={(e) => setHaToken(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button 
                onClick={handleTestConnection}
                disabled={!haUrl || !haToken || testingHA || loading}
                className="flex-1 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {testingHA ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                {t('onboarding.step2.test')}
              </button>
              
              <button 
                onClick={handleSaveConnection}
                disabled={testResult !== 'success' || loading}
                className="flex-[2] px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('onboarding.step2.save')}
              </button>
            </div>
            {testResult === 'success' && (
              <p className="text-success text-sm font-medium text-center animate-in fade-in">{t('onboarding.step2.success')}</p>
            )}
          </div>
        )}

        {/* STEP 3: Finalize */}
        {step === 3 && (
          <div className="space-y-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h2 className="text-xl font-bold">{t('onboarding.step3.title')}</h2>
            <p className="text-muted-foreground text-sm">
              {t('onboarding.step3.subtitle')}
            </p>

            <div className="pt-6">
              <button 
                onClick={finalizeSetup}
                disabled={loading}
                className="w-full px-6 py-3 bg-success text-success-foreground rounded-lg font-semibold hover:bg-success/90 transition-colors shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('onboarding.step3.complete')}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
