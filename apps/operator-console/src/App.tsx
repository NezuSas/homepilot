import { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  Home,
  BarChart2,
  Zap,
  PlaySquare,
  Sparkles,
  Settings,
  ShieldAlert,
  ShieldCheck,
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
import { API_ENDPOINTS, API_BASE_URL } from './config';
import { apiFetch } from './lib/apiClient';
import { useSession } from './lib/useSession';
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
import ResilienceShowcaseView from './views/ResilienceShowcaseView';
import { EnergyView } from './views/EnergyView';
import { SystemStatusBar } from './components/SystemStatusBar';
import { SidebarItem } from './components/ui/SidebarItem';
import { Button } from './components/ui/Button';
import { DEFAULT_HOME_MODE, getSafeHomeMode } from './types';
import type { HomeMode, View } from './types';
import { useRealtimeEvents } from './lib/useRealtimeEvents';
import { useAppShellStore } from './stores/useAppShellStore';
import { useAssistantStore } from './stores/useAssistantStore';
import { useDeviceSnapshotStore } from './stores/useDeviceSnapshotStore';
import { useDemoGuideStore, type DemoStep } from './stores/useDemoGuideStore';
import { DemoGuideOverlay } from './components/DemoGuideOverlay';

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
/** Shape returned by /api/v1/system/setup-status — mirrors OnboardingView.SetupStatus */
interface SetupStatus {
  isInitialized: boolean;
  requiresOnboarding: boolean;
  hasAdminUser: boolean;
  hasHAConfig: boolean;
  haConnectionValid: boolean;
}

function App() {
  const { t, i18n } = useTranslation();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [loadingSetup, setLoadingSetup] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isBackendOffline, setIsBackendOffline] = useState(false);
  const [currentMode, setCurrentMode] = useState<HomeMode>(DEFAULT_HOME_MODE);
  const [isSystemExpanded, setIsSystemExpanded] = useState(false);

  const resetAppShellState = useAppShellStore((state) => state.resetAppShellState);
  const resetAssistantState = useAssistantStore((state) => state.resetAssistantState);
  const resetSnapshotState = useDeviceSnapshotStore((state) => state.resetSnapshotState);

  // ─── Session Management ───────────────────────────────────────────────
  const onSessionCleared = useCallback(() => {
    resetAppShellState();
    resetAssistantState();
    resetSnapshotState();
  }, [resetAppShellState, resetAssistantState, resetSnapshotState]);

  const { isAuthenticated, user, handleLoginSuccess, handleLogout, clearSession } = useSession(onSessionCleared);

  // ─── Real-time Integration ───────────────────────────────────────────
  const { lastEvent: lastRealtimeEvent } = useRealtimeEvents(isAuthenticated);
  const assistantSummary = useAppShellStore((state) => state.assistantSummary);
  const isAllSynced = useAppShellStore((state) => state.isAllSynced);
  const refreshAssistantSummary = useAppShellStore((state) => state.refreshAssistantSummary);
  const pulseSyncStatus = useAppShellStore((state) => state.pulseSyncStatus);
  const refreshAssistantFindings = useAssistantStore((state) => state.refreshFindings);
  const refreshDeviceSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const startDemo = useDemoGuideStore((state) => state.startDemo);

  const DEMO_STEPS: DemoStep[] = [
    {
      id: 'dashboard',
      target: '[data-demo="nav-dashboard"]',
      titleKey: 'demo.steps.dashboard.title',
      descriptionKey: 'demo.steps.dashboard.description',
      view: 'dashboard'
    },
    {
      id: 'devices',
      target: '[data-demo="device-tile"]',
      titleKey: 'demo.steps.devices.title',
      descriptionKey: 'demo.steps.devices.description',
      view: 'dashboard'
    },
    {
      id: 'automations',
      target: '[data-demo="nav-automations"]',
      titleKey: 'demo.steps.automations.title',
      descriptionKey: 'demo.steps.automations.description',
      view: 'automations'
    },
    {
      id: 'resilience',
      target: '[data-demo="nav-resilience"]',
      titleKey: 'demo.steps.resilience.title',
      descriptionKey: 'demo.steps.resilience.description',
      view: 'resilience-showcase'
    }
  ];

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  // Check setup status once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingSetup(true);
      apiFetch(API_ENDPOINTS.system.setupStatus)
        .then(res => {
          const contentType = res.headers.get('content-type');
          if (!res.ok || !contentType || !contentType.includes('application/json')) {
             throw new Error('BACKEND_ERROR');
          }
          return res.json() as Promise<SetupStatus>;
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
      refreshAssistantSummary();
    }
  }, [isAuthenticated, refreshAssistantSummary]);

  useEffect(() => {
    if (!lastRealtimeEvent) {
      return;
    }

    pulseSyncStatus();

    const REFRESH_TRIGGER_EVENTS = [
      'DeviceDiscoveredEvent',
      'HomeCreatedEvent',
      'RoomCreatedEvent',
      'DeviceAssignedToRoomEvent'
    ];

    if (REFRESH_TRIGGER_EVENTS.includes(lastRealtimeEvent.type)) {
      refreshDeviceSnapshot();
      refreshAssistantFindings();
      refreshAssistantSummary();
    }
  }, [lastRealtimeEvent, pulseSyncStatus, refreshAssistantFindings, refreshAssistantSummary, refreshDeviceSnapshot]);

  const onLogout = useCallback(async () => {
    await handleLogout(async () => {
      await apiFetch(`${API_BASE_URL}/api/v1/auth/logout`, { method: 'POST' });
    });
  }, [handleLogout]);

  const handlePasswordChanged = useCallback(() => {
    clearSession();
    setShowPwdModal(false);
  }, [clearSession]);

  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

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
            onCompleted={() => setSetupStatus((prev) => prev ? { ...prev, requiresOnboarding: false } : null)} 
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
      case 'resilience-showcase': return t('nav.resilience_showcase');
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
      case 'resilience-showcase': return t('dashboard.resilience_insight');
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
               id="demo-nav-dashboard"
               data-demo="nav-dashboard"
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
               data-demo="nav-automations"
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
             <SidebarItem 
               icon={ShieldCheck} 
               label={t('nav.resilience_showcase')} 
               active={currentView === 'resilience-showcase'} 
               onClick={() => navigateTo('resilience-showcase')} 
               data-demo="nav-resilience"
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
               active={currentView === 'dashboards'}
               onClick={() => navigateTo('dashboards')}
             />
             <SidebarItem 
               icon={Zap} 
               label={t('nav.energy')} 
               active={currentView === 'energy'}
               onClick={() => navigateTo('energy')}
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
          <button
            onClick={() => startDemo(DEMO_STEPS)}
            className="hidden lg:flex items-center gap-2 w-full px-3 py-2.5 rounded-xl bg-primary/5 text-primary hover:bg-primary/10 transition-all border border-primary/10 group"
          >
            <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t('demo.start_button')}</span>
          </button>
          <div className="pt-1 flex flex-col gap-1">
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
                  onClick={onLogout}
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
                    pulseSyncStatus();
                  }}
                />
              )}
             {/* Spaces = TopologyView (user-facing room management) */}
             {currentView === 'spaces' && <TopologyView />}
              {currentView === 'scenes' && (
                <ScenesView 
                  onActionExecute={() => {
                     pulseSyncStatus();
                  }}
                />
              )}
             {currentView === 'automations' && <AutomationsView />}
             {currentView === 'assistant' && <AssistantView onNavigate={navigateTo} />}
             {currentView === 'resilience-showcase' && <ResilienceShowcaseView />}

              {/* Custom Dashboards */}
               {currentView === 'dashboards' && <DashboardsView />}

              {currentView === 'energy' && (
                <EnergyView onNavigate={navigateTo} />
              )}

             {/* System section views */}
             {currentView === 'system-devices' && <InboxView mode="manager" />}
             {currentView === 'system-inbox' && <InboxView mode="discovery" />}
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
      <DemoGuideOverlay onNavigate={navigateTo} />
    </div>
  );
}

export default App;
