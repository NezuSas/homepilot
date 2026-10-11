import { Monitor, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OnboardingView } from '../views/OnboardingView';
import type { SetupStatus } from '../appShellTypes';
import type { UserContext } from '../lib/useSession';
import { Heading } from './ui/Heading';

/** Shown while the stored session is validated against the backend. */
export function SessionCheckScreen() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden">
      {/* Cinematic Atmospheric background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 animate-pulse duration-3000" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-glow-orb h-glow-orb bg-primary/10 rounded-full blur-glow-xl opacity-20 animate-pulse" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping duration-2000" />
          <div className="relative w-16 h-16 bg-card border-2 border-primary/20 rounded-3xl flex items-center justify-center rotate-12 hover:rotate-0 transition-transform duration-500 shadow-2xl">
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2">
          <Heading variant="section" as="h2" className="uppercase">{t('shell.status.verifying_session')}</Heading>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-primary hp-typing-dot" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-12 text-micro uppercase font-black tracking-label-hero text-muted-foreground opacity-30">
        {t('shell.status.security_gate')}
      </div>
    </div>
  );
}

/** Minimal full-screen wait while the setup status is read. */
export function SetupLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Monitor className="w-8 h-8 animate-pulse text-muted-foreground" />
    </div>
  );
}

interface OnboardingScreenProps {
  setupStatus: SetupStatus;
  user: UserContext | null;
  onCompleted: () => void;
}

/** Blocks the whole shell until the installation is onboarded. */
export function OnboardingScreen({ setupStatus, user, onCompleted }: OnboardingScreenProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      <header className="h-16 border-b flex items-center px-6 bg-card shrink-0">
        <Monitor className="w-6 h-6 mr-3 text-primary" />
        <Heading variant="section" as="h1">{t('shell.app_title')} {t('shell.app_edge')}</Heading>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <OnboardingView statusProvider={setupStatus} userContext={user} onCompleted={onCompleted} />
      </main>
    </div>
  );
}
