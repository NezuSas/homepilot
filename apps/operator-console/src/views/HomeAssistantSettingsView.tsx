import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Globe, Database, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from '../components/ui/Button';
import { HomeAssistantSettingsSkeleton } from '../components/ui/ComponentSkeletons';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { SectionHeader } from '../components/ui/SectionHeader';

interface HASettingsStatus {
  baseUrl: string;
  hasToken: boolean;
  maskedToken: string;
  configurationStatus: 'not_configured' | 'configured';
  connectivityStatus: 'unknown' | 'reachable' | 'unreachable' | 'auth_error';
  lastCheckedAt: string | null;
  activeSource: 'database' | 'env-fallback' | 'none';
}

export const HomeAssistantSettingsView: React.FC = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<HASettingsStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setError(null);
      const response = await apiFetch(`${API_BASE_URL}/api/v1/settings/home-assistant`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      setStatus(data);
      setBaseUrl(data.baseUrl || '');
    } catch (error: unknown) {
      console.error('Error fetching HA status:', error);
      setError(error instanceof Error ? error.message : t('common.errors.connection_error'));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Saves refresh the status explicitly.

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/settings/home-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, accessToken: token || undefined })
      });
      if (response.ok) {
        setMessage({ type: 'success', text: t('ha_settings.messages.save_success') });
        setToken(''); // Reset token field
        fetchStatus();
      } else {
        const err = await response.json();
        const msg = err.error?.message || (typeof err.error === 'string' ? err.error : t('ha_settings.messages.save_error'));
        setMessage({ type: 'error', text: msg });
      }
    } catch {
      setMessage({ type: 'error', text: t('ha_settings.messages.network_error') });
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/settings/test-ha-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl, accessToken: token || '' })
      });
      const data = await response.json();
      setTestResult(data);
      if (data.success) {
        fetchStatus();
      }
    } catch {
      setTestResult({ success: false, message: t('ha_settings.messages.network_error') });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (s: HASettingsStatus['connectivityStatus'] | 'error') => {
    switch (s) {
      case 'reachable':   return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'unreachable': return <XCircle className="w-5 h-5 text-danger" />;
      case 'auth_error':  return <AlertTriangle className="w-5 h-5 text-warning" />;
      default: return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-in fade-in">
      <div className="p-3 bg-danger/10 rounded-full">
        <AlertCircle className="w-8 h-8 text-danger" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{t('ha_settings.status_card.error_title')}</h3>
        <p className="text-body text-muted-foreground mb-4">{error}</p>
        <Button
          onClick={fetchStatus}
        >
          {t('common.retry')}
        </Button>
      </div>
    </div>
  );

  if (!status) return (
    <HomeAssistantSettingsSkeleton label={t('common.loading')} />
  );

  return (
    <div className="flex w-full min-w-0 max-w-4xl flex-col gap-4">
      <SectionHeader level="view" icon={ShieldCheck} title={t('ha_settings.title')} />
      <div>
        {/* Status Card */}
        <Card className="flex min-w-0 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div>
                <h3 className="font-semibold text-foreground">{t('ha_settings.status_card.title')}</h3>
                <p className="text-caption text-muted-foreground">{t('ha_settings.status_card.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1.5">
              {getStatusIcon(status.connectivityStatus)}
              <span className="text-body font-medium capitalize">
                {status.connectivityStatus === 'reachable' ? t('ha_settings.status.reachable') : 
                 status.connectivityStatus === 'unreachable' ? t('ha_settings.status.unreachable') : 
                 status.connectivityStatus === 'auth_error' ? t('ha_settings.status.auth_error') : t('ha_settings.status.unknown')}
              </span>
            </div>
          </div>

          <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div className="space-y-1">
              <span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">{t('ha_settings.status_card.active_source')}</span>
              <div className="flex items-center gap-2 text-body font-medium">
                {status.activeSource === 'database' ? <Database className="w-3.5 h-3.5 text-primary" /> : <Globe className="w-3.5 h-3.5 text-warning" />}
                <span>{t(`ha_settings.sources.${status.activeSource}`)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-micro uppercase font-bold tracking-wider text-muted-foreground">{t('ha_settings.status_card.last_checked')}</span>
              <div className="text-body font-medium">
                {status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleTimeString() : t('common.never')}
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Form Section */}
      <Card className="rounded-2xl">
        <header className="border-b border-border p-4">
          <h3 className="font-semibold">{t('ha_settings.config.title')}</h3>
          <p className="text-caption text-muted-foreground">{t('ha_settings.config.subtitle')}</p>
        </header>

        <form onSubmit={handleSave} className="min-w-0 space-y-4 p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Input
                label={t('ha_settings.config.url_label')}
                icon={<Globe className="w-4 h-4" />}
                type="url" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://192.168.1.100:8123"
                className="font-mono"
                required
              />
              <p className="text-caption text-muted-foreground">{t('ha_settings.test.url_hint')}</p>
            </div>

            <div className="space-y-2">
              <div>
                <Input
                  label={t('ha_settings.config.token_label')}
                  icon={<Database className="w-4 h-4" />}
                  type="password" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={status.hasToken ? t('ha_settings.config.token_masked', { token: status.maskedToken }) : t('ha_settings.config.token_placeholder')}
                />
              </div>
              <p className="text-caption text-muted-foreground">{t('ha_settings.config.token_hint')}</p>
            </div>
          </div>

          {testResult && (
            <div role="status" className={`flex gap-3 rounded-xl border p-3 text-foreground ${testResult.success ? 'bg-success/5 border-success/20' : 'bg-danger/5 border-danger/20'}`}>
              {testResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0 text-success" /> : <XCircle className="w-5 h-5 shrink-0 text-danger" />}
              <div className="min-w-0 break-words text-body-compact">
                <p className="font-bold">{testResult.success ? t('ha_settings.test.success') : t('ha_settings.test.failure')}</p>
                <p className="opacity-90">{testResult.message || (testResult.success ? t('ha_settings.test.success_msg') : t('ha_settings.test.failure_msg'))}</p>
              </div>
            </div>
          )}

          {message && (
             <div role="status" className={`rounded-xl border p-3 text-body-compact text-foreground ${message.type === 'success' ? 'bg-success/10 border-success/20' : 'bg-danger/10 border-danger/20'}`}>
                {message.text}
             </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <Button
              type="button"
              onClick={handleTest}
              disabled={testing || !baseUrl}
              variant="outline"
              className="gap-2 whitespace-normal"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? t('ha_settings.status_card.testing') : t('ha_settings.status_card.test_button')}
            </Button>

            <Button
              type="submit"
              disabled={loading || !baseUrl}
              className="gap-2 whitespace-normal"
            >
              <Save className="w-4 h-4" />
              {t('ha_settings.status_card.save_button')}
            </Button>
          </div>
          <details className="text-caption text-muted-foreground">
            <summary className="cursor-pointer py-2 font-medium">{t('ha_settings.security.title')}</summary>
            <p className="max-w-prose">{t('ha_settings.security.description')}</p>
          </details>
        </form>
      </Card>
    </div>
  );
};
