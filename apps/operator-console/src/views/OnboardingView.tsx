import { useState } from 'react';
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
        const msg = data.error?.message || (typeof data.error === 'string' ? data.error : 'Connection failed');
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
      if (!res.ok) throw new Error('Failed to save connection');
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
      const res = await fetch(`${API_BASE_URL}/api/v1/system/setup/initialize`, {
        method: 'POST'
      });
      
      if (!res.ok) {
        const errData = await res.json();
        const msg = errData.error?.message || (typeof errData.error === 'string' ? errData.error : 'Failed to complete onboarding');
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
          <h1 className="text-2xl font-bold">First-Run Setup</h1>
          <p className="text-muted-foreground mt-1 text-center">
            Welcome to HomePilot Edge. Let's get your local network configured.
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 p-4 rounded-lg flex items-start gap-3 text-red-500">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span className="text-sm font-medium">{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: Diagnostic Matrix */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">1</span>
              System Diagnostic
            </h2>
            
            <div className="space-y-3 bg-muted/30 p-4 rounded-lg border text-sm">
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Admin Access</span>
                {isAdmin ? <span className="text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> OK ({userContext?.username})</span> : <span className="text-red-500 font-medium">Missing Role</span>}
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Home Assistant Config</span>
                {statusProvider?.hasHAConfig ? <span className="text-emerald-500 font-medium flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Present</span> : <span className="text-amber-500 font-medium">Missing</span>}
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Last Connection State</span>
                <span className={statusProvider?.haConnectionValid ? 'text-emerald-500 font-medium' : 'text-amber-500 font-medium'}>
                  {statusProvider?.haConnectionValid ? 'Valid' : 'Unknown / Unreachable'}
                </span>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button 
                onClick={() => setStep(2)}
                disabled={!isAdmin}
                className="w-full sm:w-auto px-6 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50"
              >
                Continue to Integration
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: HA Integration */}
        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-2">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full inline-flex items-center justify-center text-xs">2</span>
              Home Assistant Core
            </h2>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Local URL</label>
                <div className="relative">
                  <Server className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="url"
                    placeholder="http://homeassistant.local:8123"
                    value={haUrl}
                    onChange={(e) => setHaUrl(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Long-Lived Access Token</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    placeholder="eyJh..."
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
                Test Connection
              </button>
              
              <button 
                onClick={handleSaveConnection}
                disabled={testResult !== 'success' || loading}
                className="flex-[2] px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Save & Continue
              </button>
            </div>
            {testResult === 'success' && (
              <p className="text-emerald-500 text-sm font-medium text-center animate-in fade-in">Connection successful!</p>
            )}
          </div>
        )}

        {/* STEP 3: Finalize */}
        {step === 3 && (
          <div className="space-y-6 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold">System Ready</h2>
            <p className="text-muted-foreground text-sm">
              Your HomePilot Edge appliance is configured and securely bonded with your Home Assistant network.
            </p>

            <div className="pt-6">
              <button 
                onClick={finalizeSetup}
                disabled={loading}
                className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition-colors shadow-lg disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Setup & Boot Workspace'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
