import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config';
import type { UserContext } from '../lib/useSession';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Heading } from '../components/ui/Heading';
import { Input } from '../components/ui/Input';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: UserContext) => void;
  ssoLinkToken?: string | null;
  ssoError?: boolean;
}

interface LoginResponse {
  token: string;
  user: UserContext;
}

export function LoginView({ onLoginSuccess, ssoLinkToken = null, ssoError = false }: LoginViewProps) {
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password, ...(ssoLinkToken ? { ssoLinkToken } : {}) })
      });

      if (!resp.ok) {
        // A temporary account past its date gets its own sentence, only after the password was right.
        const body = await resp.json().catch(() => null) as { error?: { code?: string } } | null;
        throw new Error(t(body?.error?.code === 'ACCOUNT_EXPIRED' ? 'login.error_expired' : 'login.error_credentials'));
      }

      const data = await resp.json() as LoginResponse;
      onLoginSuccess(data.token, data.user);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : t('login.error_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <Card variant="flat" radius="panel" className="max-w-md w-full p-8 shadow-sm space-y-8">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <Heading variant="view" as="h1">{t('login.title')}</Heading>
            <p className="text-body text-muted-foreground mt-1">{t('login.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          {ssoError && (
            <AlertBanner variant="danger" size="sm" message={t('login.sso_error')} />
          )}
          {error && (
            <AlertBanner variant="danger" size="sm" icon={Lock} message={error} />
          )}

          <Input
              label={t('login.username')}
              type="text"
              required
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />

          <Input
              label={t('login.password')}
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />

          <Button
            type="submit" 
            isLoading={loading}
            className="mt-4 w-full"
          >
            {t('login.button')}
          </Button>
        </form>
      </Card>
    </div>
  );
}
