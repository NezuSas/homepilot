import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Globe, Database, Cpu, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';

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
    } catch (error: any) {
      console.error('Error fetching HA status:', error);
      setError(error.message || t('common.errors.connection_error'));
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

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
    } catch (error) {
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
    } catch (error) {
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
      default: return <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin-slow" />;
    }
  };

  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 animate-in fade-in">
      <div className="p-3 bg-rose-500/10 rounded-full">
        <AlertCircle className="w-8 h-8 text-rose-500" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{t('ha_settings.status_card.error_title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <button 
          onClick={fetchStatus}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all"
        >
          {t('common.retry')}
        </button>
      </div>
    </div>
  );

  if (!status) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Status Card */}
        <div className="md:col-span-2 bg-card/40 border rounded-2xl p-6 backdrop-blur-xl flex flex-col gap-4 shadow-sm border-white/10 ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${status.connectivityStatus === 'reachable' ? 'bg-success/10' : 'bg-danger/10'}`}>
                <Cpu className={`w-5 h-5 ${status.connectivityStatus === 'reachable' ? 'text-success' : 'text-danger'}`} />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('ha_settings.status_card.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('ha_settings.status_card.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-background/50 px-3 py-1.5 rounded-full border border-white/5 shadow-inner">
              {getStatusIcon(status.connectivityStatus)}
              <span className="text-sm font-medium capitalize">
                {status.connectivityStatus === 'reachable' ? t('ha_settings.status.reachable') : 
                 status.connectivityStatus === 'unreachable' ? t('ha_settings.status.unreachable') : 
                 status.connectivityStatus === 'auth_error' ? t('ha_settings.status.auth_error') : t('ha_settings.status.unknown')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="bg-background/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{t('ha_settings.status_card.active_source')}</span>
              <div className="flex items-center gap-2 text-sm font-medium">
                {status.activeSource === 'database' ? <Database className="w-3.5 h-3.5 text-primary" /> : <Globe className="w-3.5 h-3.5 text-warning" />}
                <span className="capitalize">{status.activeSource.replace('-', ' ')}</span>
              </div>
            </div>
            <div className="bg-background/40 p-3 rounded-xl border border-white/5 space-y-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{t('ha_settings.status_card.last_checked')}</span>
              <div className="text-sm font-medium">
                {status.lastCheckedAt ? new Date(status.lastCheckedAt).toLocaleTimeString() : t('common.never')}
              </div>
            </div>
          </div>
        </div>

        {/* Security Info Card */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col gap-3 relative overflow-hidden group">
          <ShieldCheck className="absolute -right-4 -bottom-4 w-32 h-32 text-primary/5 group-hover:scale-110 transition-transform duration-700" />
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            {t('ha_settings.security.title')}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('ha_settings.security.description')}
          </p>
          <div className="mt-auto pt-2">
             <span className="text-[10px] bg-primary/20 text-primary-foreground px-2 py-1 rounded font-bold">{t('ha_settings.security.badge')}</span>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="bg-card/40 border rounded-2xl overflow-hidden shadow-sm">
        <header className="border-b p-6 bg-muted/20">
          <h3 className="font-semibold">{t('ha_settings.config.title')}</h3>
          <p className="text-sm text-muted-foreground">{t('ha_settings.config.subtitle')}</p>
        </header>

        <form onSubmit={handleSave} className="p-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                {t('ha_settings.config.url_label')}
              </label>
              <input 
                type="url" 
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://192.168.1.100:8123"
                className="w-full bg-background/50 border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground">{t('ha_settings.test.url_hint')}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-muted-foreground" />
                {t('ha_settings.config.token_label')}
              </label>
              <div className="relative group">
                <input 
                  type="password" 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={status.hasToken ? t('ha_settings.config.token_masked', { token: status.maskedToken }) : t('ha_settings.config.token_placeholder')}
                  className="w-full bg-background/50 border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-mono text-sm pr-12"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                   {status.hasToken && <CheckCircle2 className="w-4 h-4 text-success" />}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{t('ha_settings.config.token_hint')}</p>
            </div>
          </div>

          {testResult && (
            <div className={`p-4 rounded-xl border flex gap-3 animate-in fade-in zoom-in-95 duration-300 ${testResult.success ? 'bg-success/5 border-success/20 text-success' : 'bg-danger/5 border-danger/20 text-danger'}`}>
              {testResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <XCircle className="w-5 h-5 shrink-0" />}
              <div className="text-sm">
                <p className="font-bold">{testResult.success ? t('ha_settings.test.success') : t('ha_settings.test.failure')}</p>
                <p className="opacity-90">{testResult.message || (testResult.success ? t('ha_settings.test.success_msg') : t('ha_settings.test.failure_msg'))}</p>
              </div>
            </div>
          )}

          {message && (
             <div className={`p-4 rounded-xl border text-sm ${message.type === 'success' ? 'bg-success/10 border-success/20 text-success' : 'bg-danger/10 border-danger/20 text-danger'}`}>
                {message.text}
             </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button 
              type="button"
              onClick={handleTest}
              disabled={testing || !baseUrl}
              className="flex items-center gap-2 text-sm font-medium px-6 py-2.5 rounded-xl border hover:bg-muted transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
              {testing ? t('ha_settings.status_card.testing') : t('ha_settings.status_card.test_button')}
            </button>

            <button 
              type="submit"
              disabled={loading || !baseUrl}
              className="flex items-center gap-2 text-sm font-bold px-8 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {t('ha_settings.status_card.save_button')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
