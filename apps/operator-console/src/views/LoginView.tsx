import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Cpu, Lock } from 'lucide-react';
import { API_BASE_URL } from '../config';
import type { UserContext } from '../lib/useSession';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface LoginViewProps {
  onLoginSuccess: (token: string, user: UserContext) => void;
}

interface LoginResponse {
  token: string;
  user: UserContext;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
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
        body: JSON.stringify({ username, password })
      });

      if (!resp.ok) {
        throw new Error(t('login.error_credentials'));
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
      <div className="max-w-md w-full p-8 border rounded-2xl bg-card shadow-sm space-y-8">
        <div className="flex flex-col items-center justify-center space-y-3 text-center">
          <div className="h-12 w-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-view-title font-bold tracking-tight">{t('login.title')}</h1>
            <p className="text-body text-muted-foreground mt-1">{t('login.subtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 pt-4">
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/50 rounded-lg text-body font-medium text-danger flex items-center gap-2">
              <Lock className="w-4 h-4" />
              {error}
            </div>
          )}

          <Input
              label={t('login.username')}
              type="text"
              required
              disabled={loading}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="rounded-md"
              placeholder="admin"
            />

          <Input
              label={t('login.password')}
              type="password"
              required
              disabled={loading}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md"
              placeholder="••••••••••••"
            />

          <Button
            type="submit" 
            isLoading={loading}
            className="mt-4 w-full rounded-md text-body font-medium"
          >
            {t('login.button')}
          </Button>
        </form>
      </div>
    </div>
  );
}
