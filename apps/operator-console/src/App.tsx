import { useState, useEffect, useEffectEvent } from 'react';
import {
  LayoutDashboard,
  Home,
  BarChart2,
  Zap,
  PlaySquare,
  Sparkles,
  Settings,
  ShieldAlert,
  Cpu,
  Activity,
  KeyRound,
  Monitor,
  Users,
  Menu,
  Globe,
  Network,
  Server,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from './lib/utils';
import { API_ENDPOINTS } from './config';
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
import { DashboardsView } from './views/DashboardsView';
import { API_BASE_URL } from './config';
import { SystemStatusBar } from './components/SystemStatusBar';
import { SidebarItem } from './components/ui/SidebarItem';
import { Button } from './components/ui/Button';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from './types';
import type { HomeMode } from './types';
import { useRealtimeEvents } from './lib/useRealtimeEvents';

/**
 * Union de vistas posibles para tipado estricto.
 *
 * Primary:         dashboard | spaces | scenes | automations | assistant
 * Personalization: dashboards (placeholder) | energy (placeholder)
 * System:          system-devices | system-inbox | system-diagnostics |
 *                  system-audit | system-users | system-ha
 *
 * Backward-compat aliases kept:
 *   topology      → spaces
 *   inbox         → system-inbox
 *   audit-logs    → system-audit
 *   ha-settings   → system-ha
 *   diagnostics   → system-diagnostics
 *   users         → system-users
 */
type View =
  // Primary
  | 'dashboard'
  | 'spaces'
  | 'scenes'
  | 'automations'
  | 'assistant'
  // Personalization (placeholders)
  | 'dashboards'
  | 'energy'
  // System
  | 'system-devices'
  | 'system-inbox'
  | 'system-diagnostics'
  | 'system-audit'
  | 'system-users'
  | 'system-ha'
  // Legacy aliases resolved at runtime (not stored in state)
  | 'topology'
  | 'inbox'
  | 'audit-logs'
  | 'ha-settings'
  | 'diagnostics'
  | 'users';

/** Resolve legacy view names to canonical ones. */
function resolveView(view: View): View {
  switch (view) {
    case 'topology':    return 'spaces';
    case 'inbox':       return 'system-inbox';
    case 'audit-logs':  return 'system-audit';
    case 'ha-settings': return 'system-ha';
    case 'diagnostics': return 'system-diagnostics';
    case 'users':       return 'system-users';
    default:            return view;
  }
}

/** Returns true if the given canonical view belongs to the System section. */
function isSystemView(view: View): boolean {
  return view === 'system-devices'
    || view === 'system-inbox'
    || view === 'system-diagnostics'
    || view === 'system-audit'
    || view === 'system-users'
    || view === 'system-ha';
}

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
  /** Controls whether the System sub-list is expanded in the sidebar. */
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);
  const { lastEvent: lastRealtimeEvent } = useRealtimeEvents(isAuthenticated);

  // ─── AUTH-1: Session Monitor ─────────────────────────────────────────
  useEffect(() => {
    if (!isAuthenticated && localStorage.getItem('hp_session_token')) {
      setIsAuthenticated(true);
    }
  }, [isAuthenticated]);

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  const refreshAssistantSummary = useEffectEvent(() => {
    fetch(API_ENDPOINTS.assistant.summary)
      .then(res => {
        const contentType = res.headers.get('content-type');
        if (!res.ok || !contentType || !contentType.includes('application/json')) {
          return null;
        }
        return res.json();
      })
      .then(data => data && setAssistantSummary(data))
      .catch(() => {});
  });

  const pulseSyncStatus = useEffectEvent(() => {
    setIsAllSynced(false);
    window.setTimeout(() => setIsAllSynced(true), 1500);
  });

  // Check setup status once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingSetup(true);
      fetch(API_ENDPOINTS.system.setupStatus)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (!res.ok || !contentType || !contentType.includes('application/json')) {
             throw new Error('BACKEND_ERROR');
          }
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
      fetch(API_ENDPOINTS.assistant.summary)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (!res.ok || !contentType || !contentType.includes('application/json')) {
             return null;
          }
          return res.json();
        })
        .then(data => data && setAssistantSummary(data))
        .catch(() => {});
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!lastRealtimeEvent) {
      return;
    }

    pulseSyncStatus();

    if (
      lastRealtimeEvent.type === 'DeviceDiscoveredEvent'
      || lastRealtimeEvent.type === 'HomeCreatedEvent'
      || lastRealtimeEvent.type === 'RoomCreatedEvent'
      || lastRealtimeEvent.type === 'DeviceAssignedToRoomEvent'
    ) {
      refreshAssistantSummary();
    }
  }, [lastRealtimeEvent, pulseSyncStatus, refreshAssistantSummary]);

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
          <h1 className="text-lg font-bold tracking-tight">{t('shell.app_title')} {t('shell.app_edge')}</h1>
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
    const resolved = resolveView(view);
    setCurrentView(resolved);
    setIsSidebarOpen(false);
    // Auto-expand system section when a system view is activated
    if (isSystemView(resolved)) {
      setIsSystemExpanded(true);
    }
  };

  const activeSystemSection = isSystemView(currentView);

  // ── Header labels ──────────────────────────────────────────────────────
  const viewTitle = (): string => {
    switch (currentView) {
      case 'dashboard':           return t('nav.dashboard');
      case 'spaces':              return t('nav.spaces');
      case 'scenes':              return t('nav.scenes');
      case 'automations':         return t('nav.automations');
      case 'assistant':           return t('nav.assistant');
      case 'dashboards':          return t('nav.dashboards');
      case 'energy':              return t('nav.energy');
      case 'system-devices':      return t('nav.system_devices');
      case 'system-inbox':        return t('nav.system_inbox');
      case 'system-diagnostics':  return t('nav.system_diagnostics');
      case 'system-audit':        return t('nav.system_audit');
      case 'system-ha':           return t('nav.system_ha');
      case 'system-users':        return t('nav.system_users');
      default:                    return t('nav.dashboard');
    }
  };

  const viewSubtitle = (): string => {
    switch (currentView) {
      case 'dashboard':           return t('dashboard.living_space');
      case 'spaces':              return t('dashboard.spaces_subtitle');
      case 'scenes':              return t('dashboard.recipes');
      case 'automations':         return t('dashboard.logic_engine');
      case 'assistant':           return t('assistant.subtitle');
      case 'system-devices':      return t('dashboard.discovery');
      case 'system-inbox':        return t('dashboard.discovery');
      case 'system-diagnostics':  return t('dashboard.observability');
      case 'system-audit':        return t('dashboard.observability');
      case 'system-ha':           return t('dashboard.platform');
      default:                    return '';
    }
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
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1 custom-scrollbar">

          {/* ── PRIMARY ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0.5">
             <SidebarItem 
               icon={Home} 
               label={t('nav.dashboard')} 
               active={currentView === 'dashboard'} 
               onClick={() => navigateTo('dashboard')} 
             />
             <SidebarItem 
               icon={LayoutDashboard} 
               label={t('nav.spaces')} 
               active={currentView === 'spaces'} 
               onClick={() => navigateTo('spaces')} 
             />
             <SidebarItem 
               icon={Monitor} 
               label={t('nav.scenes')} 
               active={currentView === 'scenes'} 
               onClick={() => navigateTo('scenes')} 
             />
             <SidebarItem 
               icon={PlaySquare} 
               label={t('nav.automations')} 
               active={currentView === 'automations'} 
               onClick={() => navigateTo('automations')} 
             />
             <SidebarItem 
               icon={Sparkles} 
               label={t('nav.assistant')} 
               active={currentView === 'assistant'} 
               onClick={() => navigateTo('assistant')}
               badge={assistantSummary?.totalOpen && assistantSummary.totalOpen > 0 
                  ? <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded text-[10px] font-black">{assistantSummary.totalOpen}</span> 
                  : undefined}
             />
          </div>

          {/* ── PERSONALIZATION ────────────────────────────────────── */}
          <div className="mt-4 mb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground opacity-40 px-3">{t('nav.group_personalization')}</span>
          </div>
          <div className="flex flex-col gap-0.5">
             <SidebarItem 
               icon={BarChart2} 
               label={t('nav.dashboards')} 
               soonText="Soon"
             />
             <SidebarItem 
               icon={Zap} 
               label={t('nav.energy')} 
               soonText="Soon"
             />
          </div>

          {/* ── DIVIDER ────────────────────────────────────────────── */}
          <div className="mx-3 my-4 border-t border-border/50" />

          {/* ── SYSTEM ─────────────────────────────────────────────── */}
          <div className="flex flex-col gap-0.5">
            <button
                onClick={() => setIsSystemExpanded(prev => !prev)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl p-3 text-sm font-bold transition-all w-full text-left",
                  activeSystemSection
                    ? 'bg-primary/10 text-primary shadow-inner shadow-primary/20'
                    : 'text-muted-foreground hover:bg-muted/80'
                )}
              >
                <div className={cn("p-2 rounded-xl transition-all duration-300", activeSystemSection ? "bg-primary text-primary-foreground shadow-lg shadow-primary/40" : "bg-muted group-hover:bg-background group-hover:shadow")}>
                    <Settings className="w-4 h-4 shrink-0" />
                </div>
                <span className="flex-1">{t('nav.system')}</span>
                {isSystemExpanded
                  ? <ChevronDown className="w-4 h-4 opacity-60" />
                  : <ChevronRight className="w-4 h-4 opacity-60" />
                }
            </button>

            {/* System sub-items — inline collapsible */}
            {isSystemExpanded && (
              <div className="mt-1 ml-5 pl-2 border-l-2 border-border/40 flex flex-col gap-1">
                 <SidebarItem
                    icon={Network}
                    label={t('nav.system_devices')}
                    active={currentView === 'system-devices'}
                    onClick={() => navigateTo('system-devices')}
                    nested
                  />
                  <SidebarItem
                    icon={Server}
                    label={t('nav.system_inbox')}
                    active={currentView === 'system-inbox'}
                    onClick={() => navigateTo('system-inbox')}
                    nested
                  />
                  <SidebarItem
                    icon={Activity}
                    label={t('nav.system_diagnostics')}
                    active={currentView === 'system-diagnostics'}
                    onClick={() => navigateTo('system-diagnostics')}
                    nested
                  />
                  <SidebarItem
                    icon={ShieldAlert}
                    label={t('nav.system_audit')}
                    active={currentView === 'system-audit'}
                    onClick={() => navigateTo('system-audit')}
                    nested
                  />
                  {user?.role === 'admin' && (
                    <SidebarItem
                      icon={Users}
                      label={t('nav.system_users')}
                      active={currentView === 'system-users'}
                      onClick={() => navigateTo('system-users')}
                      nested
                    />
                  )}
                  <SidebarItem
                    icon={Settings}
                    label={t('nav.system_ha')}
                    active={currentView === 'system-ha'}
                    onClick={() => navigateTo('system-ha')}
                    nested
                  />
              </div>
            )}
          </div>
        </nav>
        
        <div className="p-4 border-t mt-auto flex flex-col gap-2 bg-background/30">
          <div className="pt-2 flex flex-col gap-1">
            <div className="flex items-center justify-between pl-3 pr-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black tracking-tight truncate">{user?.username || t('common.unknown')}</span>
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
                  title={t('shell.tooltips.change_password')}
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <Button 
                  onClick={handleLogout}
                  variant="danger"
                  size="sm"
                  className="px-2 py-1.5 h-auto text-[10px] uppercase tracking-tighter"
                >
                  {t('nav.logout')}
                </Button>
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
                {viewTitle()}
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
            {activeSystemSection && (
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 mb-1">
                {t('nav.system')}
              </p>
            )}
            <h1 className="text-3xl font-black tracking-tighter text-foreground/90 leading-tight">
              {viewTitle()}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl font-bold uppercase tracking-widest opacity-40">
              {viewSubtitle()}
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
             {/* Spaces = TopologyView (user-facing room management) */}
             {currentView === 'spaces' && <TopologyView />}
             {currentView === 'scenes' && (
               <ScenesView 
                 onActionExecute={() => {
                    setIsAllSynced(false);
                    setTimeout(() => setIsAllSynced(true), 1500);
                 }}
               />
             )}
             {currentView === 'automations' && <AutomationsView />}
             {currentView === 'assistant' && <AssistantView onNavigate={navigateTo} />}

              {/* Custom Dashboards */}
              {currentView === 'dashboards' && <DashboardsView />}






             {currentView === 'energy' && (
               <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                 <Zap className="w-8 h-8 mb-3 opacity-30" />
                 <p className="text-sm font-bold">{t('nav.energy')}</p>
                 <p className="text-xs mt-1 opacity-50">{t('nav.coming_soon')}</p>
               </div>
             )}

             {/* System section views */}
             {currentView === 'system-devices' && <InboxView />}
             {currentView === 'system-inbox' && <InboxView />}
             {currentView === 'system-diagnostics' && <DiagnosticsView />}
             {currentView === 'system-audit' && <AuditLogsView />}
             {currentView === 'system-ha' && <HomeAssistantSettingsView />}
             {currentView === 'system-users' && <UsersView />}
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

export default App;
