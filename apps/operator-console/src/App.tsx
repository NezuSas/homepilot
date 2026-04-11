import { useState, useEffect, type ReactNode } from 'react';
import { LayoutDashboard, Network, Server, PlaySquare, Settings, ShieldAlert, Cpu, Activity, KeyRound, Monitor, Users, Menu, Globe } from 'lucide-react';
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
import { API_BASE_URL } from './config';

/**
 * Union de vistas posibles para tipado estricto.
 */
type View = 'dashboard' | 'topology' | 'inbox' | 'automations' | 'audit-logs' | 'ha-settings' | 'diagnostics' | 'users';

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

  const toggleLanguage = () => {
    const nextLang = i18n.language.startsWith('es') ? 'en' : 'es';
    i18n.changeLanguage(nextLang);
  };

  // Check setup status once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingSetup(true);
      fetch(`${API_BASE_URL}/api/v1/system/setup-status`)
        .then(res => res.json())
        .then(data => {
          setSetupStatus(data);
        })
        .catch(console.error)
        .finally(() => setLoadingSetup(false));
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

  const menuItems = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'topology', label: t('nav.topology'), icon: Network },
    { id: 'inbox', label: t('nav.inbox'), icon: Server },
    { id: 'automations', label: t('nav.automations'), icon: PlaySquare },
    { id: 'audit-logs', label: t('nav.audit_logs'), icon: ShieldAlert },
    { id: 'ha-settings', label: t('nav.ha_settings'), icon: Settings },
    { id: 'diagnostics', label: t('nav.diagnostics'), icon: Activity },
    { id: 'users', label: t('nav.user_management'), icon: Users },
  ];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground antialiased selection:bg-primary/10">
      
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
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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
              icon={<PlaySquare className="w-4 h-4" />} 
              label={t('nav.automations')} 
              active={currentView === 'automations'} 
              onClick={() => navigateTo('automations')} 
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
            onClick={() => navigateTo('diagnostics')}
            className={cn(
              "flex items-center gap-3 text-xs transition-all w-full p-3 rounded-xl font-bold uppercase tracking-wider",
              currentView === 'diagnostics' ? 'bg-amber-500/10 text-amber-600' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Activity className="w-4 h-4" />
            {t('nav.diagnostics')}
          </button>
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
                "flex items-center gap-3 text-xs transition-all w-full p-3 rounded-xl font-bold uppercase tracking-wider",
                currentView === 'users' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Users className="w-4 h-4" />
              {t('nav.user_management')}
            </button>
          )}
          
          <div className="pt-4 border-t mt-2">
            <div className="flex items-center justify-between px-2">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-black tracking-tight truncate">{user?.username || 'user'}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{user?.role || 'operator'}</span>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={toggleLanguage}
                  className="text-muted-foreground hover:text-foreground transition-all p-2 rounded-lg hover:bg-muted"
                  title="Switch Language"
                >
                  <Globe className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowPwdModal(true)}
                  className="text-muted-foreground hover:text-foreground transition-all p-2 rounded-lg hover:bg-muted"
                  title="Change Password"
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        
        {/* Mobile Header */}
        <header className="lg:hidden h-16 border-b flex items-center justify-between px-6 bg-card/60 backdrop-blur-md sticky top-0 z-[30]">
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setIsSidebarOpen(true)}
               className="p-2 -ml-2 text-muted-foreground hover:text-foreground transition-colors"
             >
               <Menu className="w-6 h-6" />
             </button>
             <h2 className="text-sm font-black uppercase tracking-widest truncate">
               {menuItems.find(m => m.id === currentView)?.label || t('shell.app_title')}
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

        {/* Desktop Title Header */}
        <header className="hidden lg:block border-b px-12 py-10 bg-card/40 backdrop-blur-sm shadow-sm">
          <div className="max-w-7xl mx-auto w-full">
            <h1 className="text-3xl font-black tracking-tighter text-foreground/90 leading-tight">
               {currentView === 'dashboard' ? t('nav.dashboard') :
                currentView === 'topology' ? t('topology.title') : 
                currentView === 'inbox' ? t('inbox.title') : 
                currentView === 'automations' ? t('nav.automations') : 
                currentView === 'ha-settings' ? t('ha_settings.title') : 
                currentView === 'users' ? t('nav.user_management') : 
                currentView === 'diagnostics' ? t('nav.diagnostics') : t('nav.observability')}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl font-medium leading-relaxed">
               {currentView === 'dashboard'
                  ? t('nav.dashboard_hint')
                  : currentView === 'topology' 
                  ? t('topology.select_home')
                  : currentView === 'inbox'
                  ? t('inbox.subtitle')
                  : currentView === 'automations'
                  ? t('nav.automations_hint')
                  : currentView === 'ha-settings'
                  ? t('ha_settings.status_card.title')
                  : t('nav.audit_trail')
               }
            </p>
          </div>
        </header>
        
        <section className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
           <div className="max-w-7xl mx-auto w-full">
            {currentView === 'dashboard' && <DashboardView />}
            {currentView === 'topology' && <TopologyView />}
            {currentView === 'inbox' && <InboxView />}
            {currentView === 'automations' && <AutomationsView />}
            {currentView === 'audit-logs' && <AuditLogsView />}
            {currentView === 'ha-settings' && <HomeAssistantSettingsView />}
            {currentView === 'diagnostics' && <DiagnosticsView />}
            {currentView === 'users' && <UsersView />}
           </div>
        </section>
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
}

const NavItem = ({ icon, label, active, disabled, onClick }: NavItemProps) => {
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
        {label}
      </a>
    </li>
  );
};

export default App;
