import { useState } from 'react';
import { CheckCircle2, Cpu, KeyRound, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { API_ENDPOINTS } from '../config';

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

function getPasswordError(password: string, confirmation: string): string | null {
  if (password.length < 10) {
    return 'La contraseña debe tener al menos 10 caracteres.';
  }
  if (password !== confirmation) {
    return 'Las contraseñas no coinciden.';
  }
  return null;
}

export function FirstAdminSetupView({ onCompleted }: FirstAdminSetupViewProps) {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedUsername = username.trim();
  const trimmedDisplayName = displayName.trim();
  const passwordError = password ? getPasswordError(password, passwordConfirmation) : null;
  const canSubmit = trimmedUsername.length >= 3
    && password.length >= 10
    && password === passwordConfirmation
    && !loading;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const currentPasswordError = getPasswordError(password, passwordConfirmation);
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
      setError(e instanceof Error ? e.message : 'No se pudo crear el administrador inicial.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-foreground">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-2xl lg:grid-cols-[1fr_26rem]">
        <section className="space-y-8 p-6 sm:p-10">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.32em] text-primary">Primer arranque</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Crea el administrador de Nezu</h1>
              <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
                Este sistema no tiene usuarios todavía. En vez de usar una clave en logs o una contraseña fija,
                crea aquí el primer administrador local. Después continuarás con la conexión de Home Assistant.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-4">
            {error && (
              <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
                {error}
              </div>
            )}

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Nombre visible</span>
              <div className="relative">
                <UserRound className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  disabled={loading}
                  className="flex h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  placeholder="Oscar"
                />
              </div>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Usuario administrador</span>
              <div className="relative">
                <Cpu className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  disabled={loading}
                  required
                  minLength={3}
                  pattern="[a-zA-Z0-9._-]+"
                  className="flex h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                  placeholder="admin"
                />
              </div>
              <span className="text-xs font-semibold text-muted-foreground">Usa letras, numeros, punto, guion o guion bajo.</span>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Contraseña</span>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                    minLength={10}
                    className="flex h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    placeholder="Minimo 10 caracteres"
                  />
                </div>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">Confirmar contraseña</span>
                <div className="relative">
                  <KeyRound className="absolute left-4 top-3.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    disabled={loading}
                    required
                    minLength={10}
                    className="flex h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-semibold shadow-sm outline-none transition focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                    placeholder="Repite la contraseña"
                  />
                </div>
              </label>
            </div>

            {passwordError && (
              <p className="text-sm font-bold text-warning">{passwordError}</p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-xs font-black uppercase tracking-widest text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Crear administrador y continuar
            </button>
          </form>
        </section>

        <aside className="border-t border-border/70 bg-muted/25 p-6 sm:p-10 lg:border-l lg:border-t-0">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-muted-foreground">Flujo correcto</p>
          <div className="mt-6 grid gap-4">
            {[
              'No se imprime contraseña de cliente en logs.',
              'No se usa admin/admin fuera de desarrollo.',
              'La primera cuenta queda creada por la persona que instala el sistema.',
              'Después se completa Home Assistant desde el onboarding protegido.'
            ].map(item => (
              <div key={item} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-4">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span className="text-sm font-bold leading-5 text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
