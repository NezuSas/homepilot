import { ChevronRight, Globe, KeyRound, LogOut, Moon, Sparkles, Sun } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { cn } from '../lib/utils';
import type { UserContext } from '../lib/useSession';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';

interface AppSidebarFooterProps {
  collapsed: boolean;
  user: UserContext | null;
  profile: { displayName: string | null; avatarDataUri: string | null };
  theme: 'dark' | 'light';
  demoStepCount: number;
  onStartDemo: () => void;
  onToggleTheme: () => void;
  onToggleLanguage: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
  onOpenProfile: () => void;
}

export function AppSidebarFooter({ collapsed, user, profile, theme, demoStepCount, onStartDemo, onToggleTheme, onToggleLanguage, onChangePassword, onLogout, onOpenProfile }: AppSidebarFooterProps) {
  const { t } = useTranslation();
  const avatarSrc = profile.avatarDataUri?.startsWith('/') ? `${API_BASE_URL}${profile.avatarDataUri}` : profile.avatarDataUri;

  return (
    <div className={cn('mt-auto flex flex-col gap-4 border-t bg-background/40 p-4 transition-all duration-300', collapsed ? 'xl:gap-0 xl:border-t-0 xl:bg-transparent xl:p-3' : 'xl:px-2 xl:py-3')}>
      <Button type="button" variant="ghost" size="sm" onClick={onStartDemo} className={cn('group hidden h-auto w-full items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-3 text-primary shadow-sm shadow-primary/5 hover:border-primary/30 hover:bg-primary/15 xl:flex', collapsed && 'xl:hidden')} title={!collapsed ? t('demo.start_button') : undefined}>
        <div className="rounded-xl bg-primary p-2 text-primary-foreground shadow-sm shadow-primary/20 transition-transform group-hover:scale-105"><Sparkles className="h-3.5 w-3.5" /></div>
        <div className={cn('flex min-w-0 flex-1 flex-col overflow-hidden text-left transition-[opacity,width] duration-200', collapsed && 'xl:w-0 xl:flex-none xl:opacity-0')}><span className="whitespace-nowrap text-micro font-semibold uppercase tracking-control">{t('demo.start_button')}</span><span className="mt-0.5 truncate text-nano font-semibold uppercase tracking-normal text-primary/70">{t('demo.sidebar_summary', { count: demoStepCount })}</span></div>
      </Button>
      <div className="flex flex-col gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenProfile} className={cn('group flex h-auto w-full items-center gap-3 rounded-2xl border border-border/40 bg-muted/30 p-2 hover:bg-muted/80', collapsed && 'xl:h-12 xl:w-12 xl:justify-center xl:rounded-full xl:border-0 xl:bg-transparent xl:p-1')} title={t('users.profile.title', 'Mi Perfil')}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-background bg-primary/10 text-primary shadow-md transition-all group-hover:border-primary/30">
            {avatarSrc ? <img src={avatarSrc} alt="avatar" className="h-full w-full object-cover shadow-inner" /> : <span className="text-caption font-black uppercase">{(user?.username || '?').substring(0, 2)}</span>}
          </div>
          <div className={cn('flex min-w-0 flex-col overflow-hidden text-left transition-[opacity,width] duration-200', collapsed && 'xl:w-0 xl:opacity-0')}><span className="truncate text-caption font-semibold tracking-tight">{profile.displayName || user?.username || t('common.unknown')}</span><span className="truncate text-nano font-semibold uppercase tracking-normal text-muted-foreground opacity-70">{user?.role ? t(`shell.compact_roles.${user.role}`) : t('common.roles.guest')}</span></div>
          <ChevronRight className={cn('ml-auto h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary', collapsed && 'xl:hidden')} />
        </Button>
        <div className={cn('flex items-center justify-around rounded-xl border border-border/30 bg-muted/20 px-1 py-1 transition-all duration-300', collapsed && 'xl:hidden')}>
          <IconButton icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? t('shell.tooltips.light_mode', 'Modo Claro') : t('shell.tooltips.dark_mode', 'Modo Oscuro')} onClick={onToggleTheme} variant="ghost" size="sm" />
          <IconButton icon={Globe} label={t('shell.tooltips.switch_language')} onClick={onToggleLanguage} variant="ghost" size="sm" />
          <IconButton icon={KeyRound} label={t('shell.tooltips.change_password')} onClick={onChangePassword} variant="ghost" size="sm" />
          <div className={cn('mx-0.5 h-4 w-px bg-border/40', collapsed && 'xl:my-0.5 xl:h-px xl:w-4 xl:mx-0')} />
          <IconButton icon={LogOut} label={t('nav.logout')} onClick={onLogout} variant="danger" size="sm" />
        </div>
      </div>
    </div>
  );
}
