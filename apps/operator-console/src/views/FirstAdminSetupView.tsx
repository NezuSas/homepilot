import { useState } from 'react';
import { CheckCircle2, Cpu, KeyRound, ShieldCheck, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../config';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';

interface FirstAdminUser {
  id: string;
  username: string;
  role: string;
  displayName: string | null;
  avatarDataUri: string | null;
}

interface FirstAdminSetupViewProps {
  onCompleted: (token: string, user: FirstAdminUser) => void;
}

function getPasswordError(password: string, confirmation: string, t: (key: string) => string): string | null {
  if (password.length < 10) {
    return t('first_admin_setup.password_length');
  }
  if (password !== confirmation) {
    return t('first_admin_setup.password_mismatch');
  }
  return null;
}

export function FirstAdminSetupView({ onCompleted }: FirstAdminSetupViewProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUsername = username.trim();
  const trimmedDisplayName = displayName.trim();
  const passwordError = password ? getPasswordError(password, passwordConfirmation, t) : null;
  const canSubmit = trimmedUsername.length >= 3
    && password.length >= 10
    && password === passwordConfirmation
    && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const currentPasswordError = getPasswordError(password, passwordConfirmation, t);
    if (currentPasswordError) {
      setError(currentPasswordError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(API_ENDPOINTS.system.bootstrapAdmin, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUsername,
          password,
          displayName: trimmedDisplayName || null
        })
      });

      const data = await response.json();
      if (!response.ok) {
        const message = data.error?.message || 'No se pudo crear el administrador inicial.';
        throw new Error(message);
      }

      onCompleted(data.token, data.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('first_admin_setup.create_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-panel border border-border/70 bg-card shadow-2xl lg:grid-cols-[1fr_26rem]">
        <section className="space-y-8 p-6 sm:p-10">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-micro font-black uppercase tracking-label-wider text-primary">{t('first_admin_setup.eyebrow')}</p>
              <h1 className="mt-2 text-display-title font-black tracking-tight sm:text-hero-title">{t('first_admin_setup.title')}</h1>
              <p className="mt-3 max-w-2xl text-body font-semibold leading-6 text-muted-foreground">
                {t('first_admin_setup.description')}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-body font-bold text-danger">
                {error}
              </div>
            )}

            <Input
              label={t('first_admin_setup.display_name')}
              icon={<UserRound className="h-4 w-4" />}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={loading}
              className="h-12 rounded-xl pl-11 pr-4 font-semibold"
              placeholder="Oscar"
            />

            <Input
              label={t('first_admin_setup.username')}
              icon={<Cpu className="h-4 w-4" />}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              disabled={loading}
              required
              minLength={3}
              pattern="[a-zA-Z0-9._-]+"
              className="h-12 rounded-xl pl-11 pr-4 font-semibold"
              placeholder="admin"
              helperText={t('first_admin_setup.username_hint')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('first_admin_setup.password')}
                icon={<KeyRound className="h-4 w-4" />}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
                minLength={10}
                className="h-12 rounded-xl pl-11 pr-4 font-semibold"
                placeholder={t('first_admin_setup.password_placeholder')}
              />

              <Input
                label={t('first_admin_setup.confirm_password')}
                icon={<KeyRound className="h-4 w-4" />}
                type="password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
                disabled={loading}
                required
                minLength={10}
                className="h-12 rounded-xl pl-11 pr-4 font-semibold"
                placeholder={t('first_admin_setup.confirm_password_placeholder')}
              />
            </div>

            {passwordError && (
              <p className="text-body font-bold text-warning">{passwordError}</p>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              isLoading={loading}
              className="mt-2 h-12 rounded-xl px-6 text-caption font-black uppercase tracking-widest shadow-lg"
            >
              {!loading && <ShieldCheck className="h-4 w-4" />}
              {t('first_admin_setup.submit')}
            </Button>
          </form>
        </section>

        <aside className="border-t border-border/70 bg-muted/25 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <p className="text-caption font-black uppercase tracking-label-wide text-muted-foreground">{t('first_admin_setup.flow_title')}</p>
          <div className="mt-6 grid gap-4">
            {[
              t('first_admin_setup.flow.no_logs'),
              t('first_admin_setup.flow.no_dev_credentials'),
              t('first_admin_setup.flow.first_account'),
              t('first_admin_setup.flow.ha_onboarding')
            ].map(item => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-body font-bold leading-5 text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
