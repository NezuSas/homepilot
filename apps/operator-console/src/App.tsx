import { useState, useEffect, type ReactNode } from 'react';
import { LayoutDashboard, Network, Server, PlaySquare, Settings, ShieldAlert, Cpu, Activity, KeyRound, Monitor, Users, Menu, Globe, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import { DashboardView } from './views/DashboardView';
import { TopologyView } from './views/TopologyView';
import { InboxView } from './views/InboxView';
import AutomationsView from './views/AutomationsView';
import { AuditLogsView } from './views/AuditLogsView';
import { HomeAssistantSettingsView } from './views/HomeAssistantSettingsView';
import { DiagnosticsView } from './views/DiagnosticsView';
import { LoginView } from './views/LoginView';
import { ChangePasswordModal } from './views/ChangePasswordModal';
import { OnboardingView } from './views/OnboardingView';
import { UsersView } from './views/UsersView';
import ScenesView from './views/ScenesView';
import { AssistantView } from './views/AssistantView';
import { API_BASE_URL } from './config';
import { SystemStatusBar } from './components/SystemStatusBar';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from './types';
import type { HomeMode } from './types';

/**
 * Union de vistas posibles para tipado estricto.
 */
type View = 'dashboard' | 'topology' | 'inbox' | 'automations' | 'scenes' | 'audit-logs' | 'ha-settings' | 'diagnostics' | 'users' | 'assistant';

/**
 * App Component
 * Aplicación principal de la Operator Console V1.
 * Gestiona el enrutamiento básico y el layout global.
 */
function App() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('hp_session_token'));
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [loadingSetup, setLoadingSetup] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAllSynced, setIsAllSynced] = useState(true);
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [currentMode, setCurrentMode] = useState<HomeMode>(DEFAULT_HOME_MODE);
  const [assistantSummary, setAssistantSummary] = useState<{ totalOpen: number } | null>(null);

  // ─── AUTH-1: Global 401 Interceptor ─────────────────────────────────────────
  // Patches window.fetch once per App lifecycle to intercept any 401 response.
  // This avoids modifying every individual fetch call site in each view.
  // On 401: clears local session and transitions to the LoginView.
  useEffect(() => {
    if (!isAuthenticated) return;

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await originalFetch(...args);
      if (res.status === 401) {
        // Avoid intercepting the login endpoint itself to prevent logout loops
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
        if (!url.includes('/auth/login')) {
          handleLogout();
        }
      }
      return res;
    };

    return () => {
      // Restore original fetch on cleanup (e.g., during logout)
      window.fetch = originalFetch;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  // Check setup status once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingSetup(true);
      fetch(`${API_BASE_URL}/api/v1/system/setup-status`)
        .then(res => {
          if (!res.ok) throw new Error('Backend failed');
          return res.json();
        })
        .then(data => {
          setSetupStatus(data);
          setIsBackendOffline(false);
        })
        .catch(() => {
          setIsBackendOffline(true);
        })
        .finally(() => setLoadingSetup(false));

      // Fetch assistant summary
      fetch(`${API_BASE_URL}/api/v1/assistant/summary`)
        .then(res => res.json())
        .then(data => setAssistantSummary(data))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const handleLoginSuccess = (token: string, user: any) => {
    localStorage.setItem('hp_session_token', token);
    localStorage.setItem('hp_user_ctx', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST' });
    } catch (e) {
      // Ignore errors if network is down or token is garbage, we still log out locally.
    } finally {
      localStorage.removeItem('hp_session_token');
      localStorage.removeItem('hp_user_ctx');
      setIsAuthenticated(false);
    }
  };

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  const handlePasswordChanged = () => {
    localStorage.removeItem('hp_session_token');
    localStorage.removeItem('hp_user_ctx');
    setIsAuthenticated(false);
    setShowPwdModal(false);
  };

  const userCtxStr = localStorage.getItem('hp_user_ctx');
  const user = userCtxStr ? JSON.parse(userCtxStr) : null;

  if (loadingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Monitor className="w-8 h-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  // Si requiere onboarding (no inicializado), bloqueamos todo el sidebar y forzamos onboarding.
  if (setupStatus?.requiresOnboarding) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
        <header className="h-16 border-b flex items-center px-6 bg-card shrink-0">
          <Monitor className="w-6 h-6 mr-3 text-primary" />
          <h1 className="text-lg font-bold tracking-tight">HomePilot Edge</h1>
        </header>
        <main className="flex-1 flex overflow-hidden">
          <OnboardingView 
            statusProvider={setupStatus} 
            userContext={user} 
            onCompleted={() => setSetupStatus((prev: any) => ({ ...prev, requiresOnboarding: false }))} 
          />
        </main>
      </div>
    );
  }


  const navigateTo = (view: View) => {
    setCurrentView(view);
    setIsSidebarOpen(false);
  };


  return (
    <div 
      className="flex h-screen w-full bg-background overflow-hidden text-foreground antialiased selection:bg-primary/10 transition-all duration-1000"
      data-home-mode={currentMode}
    >
      
      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[40] lg:hidden animate-in fade-in duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Responsive Drawer) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-[50] w-72 border-r bg-card flex flex-col transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:flex lg:w-64 lg:bg-muted/40",
        isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}>
        <div className="p-6 border-b flex flex-col gap-1 shrink-0 bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <Cpu className="w-6 h-6" />
              <h2 className="font-black tracking-tighter text-xl">{t('shell.app_title')} <span className="text-foreground">{t('shell.app_edge')}</span></h2>
            </div>
          </div>
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground opacity-50 mt-1">{t('shell.subtitle')}</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="grid gap-1 px-4">
            <NavItem 
              icon={<LayoutDashboard className="w-4 h-4" />} 
              label={t('nav.dashboard')} 
              active={currentView === 'dashboard'} 
              onClick={() => navigateTo('dashboard')} 
            />
            <NavItem 
              icon={<PlaySquare className="w-4 h-4" />} 
              label={t('nav.automations')} 
              active={currentView === 'automations'} 
              onClick={() => navigateTo('automations')} 
            />
            <NavItem 
              icon={<Monitor className="w-4 h-4" />} 
              label={t('nav.scenes')} 
              active={currentView === 'scenes'} 
              onClick={() => navigateTo('scenes')} 
            />
            <NavItem 
              icon={<Sparkles className="w-4 h-4 text-primary" />} 
              label={t('nav.assistant')} 
              active={currentView === 'assistant'} 
              onClick={() => navigateTo('assistant')}
              badge={assistantSummary?.totalOpen && assistantSummary.totalOpen > 0 ? assistantSummary.totalOpen : undefined}
              badgeColor="bg-primary text-primary-foreground"
            />
          </ul>

          <div className="mt-8 px-6 mb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{t('system.advanced')}</span>
          </div>
          <ul className="grid gap-1 px-4">
            <NavItem 
              icon={<Network className="w-4 h-4" />} 
              label={t('nav.topology')} 
              active={currentView === 'topology'} 
              onClick={() => navigateTo('topology')} 
            />
            <NavItem 
              icon={<Server className="w-4 h-4" />} 
              label={t('nav.inbox')} 
              active={currentView === 'inbox'} 
              onClick={() => navigateTo('inbox')} 
            />
            <NavItem 
              icon={<Activity className="w-4 h-4" />} 
              label={t('nav.diagnostics')} 
              active={currentView === 'diagnostics'} 
              onClick={() => navigateTo('diagnostics')} 
            />
            <NavItem 
              icon={<ShieldAlert className="w-4 h-4" />} 
              label={t('nav.audit_logs')} 
              active={currentView === 'audit-logs'}
              onClick={() => navigateTo('audit-logs')}
            />
          </ul>
        </nav>
        
        <div className="p-4 border-t mt-auto flex flex-col gap-2 bg-background/30">
          <button 
            onClick={() => navigateTo('ha-settings')}
            className={cn(
              "flex items-center gap-3 text-xs transition-all w-full p-3 rounded-xl font-bold uppercase tracking-wider",
              currentView === 'ha-settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Settings className="w-4 h-4" />
            {t('nav.ha_settings')}
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => navigateTo('users')}
              className={cn(
                "flex items-center gap-3 text-xs transition-all w-full p-3 rounded-xl font-bold uppercase tracking-wider text-left",
                currentView === 'users' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{user?.role === 'admin' ? t('users.header.title') : t('nav.user_management')}</span>
            </button>
          )}
          
          <div className="pt-4 border-t mt-2">
            <div className="flex items-center justify-between pl-3 pr-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black tracking-tight truncate">{user?.username || 'user'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={toggleLanguage}
                  className="text-muted-foreground hover:text-foreground transition-all p-2 rounded-lg hover:bg-muted"
                  title={t('shell.tooltips.switch_language')}
                >
                  <Globe className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowPwdModal(true)}
                  className="text-muted-foreground hover:text-foreground transition-all p-2 rounded-lg hover:bg-muted"
                  title={t('change_password.button_tooltip')}
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-rose-500 transition-all p-2 rounded-lg hover:bg-rose-500/10 font-black text-[10px] uppercase tracking-tighter"
                >
                  {t('nav.logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b flex items-center justify-between px-6 bg-card shrink-0 z-[30]">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
             >
               <Menu className="w-6 h-6" />
             </button>
              <h2 className="text-sm font-black uppercase tracking-widest truncate">
                {currentView === 'dashboard' ? t('nav.dashboard') :
                 currentView === 'topology' ? t('topology.title') : 
                 currentView === 'inbox' ? t('inbox.title') : 
                 currentView === 'automations' ? t('nav.automations') : 
                 currentView === 'ha-settings' ? t('ha_settings.title') : 
                 currentView === 'users' ? t('nav.user_management') : 
                 currentView === 'diagnostics' ? t('nav.diagnostics') : 
                 currentView === 'scenes' ? t('nav.scenes') :
                 currentView === 'assistant' ? t('nav.assistant') :
                 currentView === 'audit-logs' ? t('nav.audit_logs') : currentView}
              </h2>
          </div>
          <div className="flex items-center gap-3">
             <button
               onClick={toggleLanguage}
               className="p-2 text-muted-foreground"
             >
               <Globe className="w-5 h-5" />
             </button>
             <Cpu className="w-5 h-5 text-primary opacity-50" />
          </div>
        </header>

        <header className="hidden lg:block border-b px-12 py-8 bg-card/60 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 flex items-center gap-3 animate-in fade-in duration-1000">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('shell.status.online')}</span>
            </div>
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10">
            <h1 className="text-3xl font-black tracking-tighter text-foreground/90 leading-tight">
               {currentView === 'dashboard' ? t('nav.dashboard') :
                currentView === 'topology' ? t('topology.title') : 
                currentView === 'inbox' ? t('inbox.title') : 
                currentView === 'automations' ? t('nav.automations') : 
                currentView === 'ha-settings' ? t('ha_settings.title') : 
                currentView === 'users' ? t('nav.user_management') : 
                currentView === 'assistant' ? t('nav.assistant') :
                currentView === 'diagnostics' ? t('nav.diagnostics') : t('nav.observability')}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl font-bold uppercase tracking-widest opacity-40">
               {currentView === 'dashboard'
                  ? t('dashboard.living_space')
                  : currentView === 'topology' 
                  ? t('dashboard.topology')
                  : currentView === 'inbox'
                  ? t('dashboard.discovery')
                  : currentView === 'automations'
                  ? t('dashboard.logic_engine')
                  : currentView === 'scenes'
                  ? t('dashboard.recipes')
                  : currentView === 'ha-settings'
                  ? t('dashboard.platform')
                  : currentView === 'assistant'
                  ? t('assistant.subtitle')
                  : t('dashboard.observability')
               }
            </p>
          </div>
        </header>
        
        <section className="flex-1 overflow-y-auto min-h-0 relative scroll-smooth p-4 sm:p-8">
           {isBackendOffline && (
             <div className="max-w-7xl mx-auto mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="bg-destructive/10 border-2 border-destructive/20 rounded-[2rem] p-6 flex items-center justify-between gap-6 backdrop-blur-xl">
                 <div className="flex items-center gap-4">
                   <div className="p-3 bg-destructive text-destructive-foreground rounded-2xl shadow-lg shadow-destructive/20">
                     <ShieldAlert className="w-6 h-6" />
                   </div>
                   <div>
                     <h3 className="font-black tracking-tight text-destructive">{t('system.connection_lost')}</h3>
                     <p className="text-[10px] uppercase font-black tracking-widest text-destructive/60">{t('system.unreachable_msg')}</p>
                   </div>
                 </div>
                 <button 
                   onClick={() => window.location.reload()}
                   className="px-6 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   {t('system.retry')}
                 </button>
               </div>
             </div>
           )}
           <div className="max-w-7xl mx-auto w-full">
             {currentView === 'dashboard' && (
               <DashboardView 
                 onModeChange={(m) => setCurrentMode(getSafeHomeMode(m))} 
                 onActionExecute={() => {
                   setIsAllSynced(false);
                   setTimeout(() => setIsAllSynced(true), 1500);
                 }}
               />
             )}
             {currentView === 'topology' && <TopologyView />}
             {currentView === 'inbox' && <InboxView />}
             {currentView === 'automations' && <AutomationsView />}
             {currentView === 'scenes' && (
               <ScenesView 
                 onActionExecute={() => {
                    setIsAllSynced(false);
                    setTimeout(() => setIsAllSynced(true), 1500);
                 }}
               />
             )}
             {currentView === 'audit-logs' && <AuditLogsView />}
             {currentView === 'ha-settings' && <HomeAssistantSettingsView />}
             {currentView === 'diagnostics' && <DiagnosticsView />}
             {currentView === 'users' && <UsersView />}
             {currentView === 'assistant' && <AssistantView onNavigate={navigateTo} />}
           </div>
        </section>

        <SystemStatusBar 
          currentMode={getSafeHomeMode(currentMode)} 
          isAllSynced={isAllSynced} 
        />
      </main>

      <ChangePasswordModal 
        isOpen={showPwdModal} 
        onClose={() => setShowPwdModal(false)}
        onSuccess={handlePasswordChanged}
      />
    </div>
  );
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  badge?: number;
  badgeColor?: string;
}

const NavItem = ({ icon, label, active, disabled, onClick, badge, badgeColor }: NavItemProps) => {
  if (disabled) {
    return (
      <li>
        <span className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-40 cursor-not-allowed">
          {icon}
          {label}
        </span>
      </li>
    );
  }

  return (
    <li>
      <a 
        href="#" 
        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
          active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
        onClick={(e) => { e.preventDefault(); onClick?.(); }}
      >
        {icon}
        <span className="flex-1">{label}</span>
        {badge !== undefined && (
          <span className={cn(
            "px-1.5 py-0.5 rounded-md text-[10px] font-black min-w-[1.2rem] text-center",
            badgeColor || "bg-muted text-muted-foreground"
          )}>
            {badge}
          </span>
        )}
      </a>
    </li>
  );
};

export default App;
