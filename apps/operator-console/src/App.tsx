import { useState, useEffect, type ReactNode } from 'react';
import { Network, Server, PlaySquare, Settings, ShieldAlert, Cpu, Activity, KeyRound, Monitor, Users, Menu } from 'lucide-react';
import { cn } from './lib/utils';
import { TopologyView } from './views/TopologyView';
import { InboxView } from './views/InboxView';
import { AutomationWorkbenchView } from './views/AutomationWorkbenchView';
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
type View = 'topology' | 'inbox' | 'automations' | 'audit-logs' | 'ha-settings' | 'diagnostics' | 'users';

/**
 * App Component
 * Aplicación principal de la Operator Console V1.
 * Gestiona el enrutamiento básico y el layout global.
 */
function App() {
  const [currentView, setCurrentView] = useState<View>('topology');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!localStorage.getItem('hp_session_token'));
  const [showPwdModal, setShowPwdModal] = useState<boolean>(false);
  const [setupStatus, setSetupStatus] = useState<any>(null);
  const [loadingSetup, setLoadingSetup] = useState<boolean>(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
              <h2 className="font-black tracking-tighter text-xl">HomePilot <span className="text-foreground">Edge</span></h2>
            </div>
          </div>
          <span className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground opacity-50 mt-1">Operator Console v3.5</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6">
          <ul className="grid gap-1 px-4">
            <NavItem 
              icon={<Network className="w-4 h-4" />} 
              label="Topology" 
              active={currentView === 'topology'} 
              onClick={() => navigateTo('topology')} 
            />
            <NavItem 
              icon={<Server className="w-4 h-4" />} 
              label="Inbox & Devices" 
              active={currentView === 'inbox'} 
              onClick={() => navigateTo('inbox')} 
            />
            <NavItem 
              icon={<PlaySquare className="w-4 h-4" />} 
              label="Automations" 
              active={currentView === 'automations'} 
              onClick={() => navigateTo('automations')} 
            />
            <NavItem 
              icon={<ShieldAlert className="w-4 h-4" />} 
              label="Audit Logs" 
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
            Diagnostics
          </button>
          <button 
            onClick={() => navigateTo('ha-settings')}
            className={cn(
              "flex items-center gap-3 text-xs transition-all w-full p-3 rounded-xl font-bold uppercase tracking-wider",
              currentView === 'ha-settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Settings className="w-4 h-4" />
            HA Settings
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
              User Management
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
                  Logout
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
               {currentView === 'topology' ? 'Topology' : 
                currentView === 'inbox' ? 'Devices' : 
                currentView === 'automations' ? 'Workbench' : 
                currentView === 'ha-settings' ? 'HA Config' : 
                currentView === 'users' ? 'Admin' : 
                currentView === 'diagnostics' ? 'Health' : 'Observability'}
             </h2>
          </div>
          <Cpu className="w-5 h-5 text-primary opacity-50" />
        </header>

        {/* Desktop Title Header */}
        <header className="hidden lg:block border-b px-12 py-10 bg-card/40 backdrop-blur-sm shadow-sm">
          <div className="max-w-7xl mx-auto w-full">
            <h1 className="text-3xl font-black tracking-tighter text-foreground/90 leading-tight">
               {currentView === 'topology' ? 'System Topology' : 
                currentView === 'inbox' ? 'Device Manager' : 
                currentView === 'automations' ? 'Automation Workbench' : 
                currentView === 'ha-settings' ? 'Home Assistant Settings' : 
                currentView === 'users' ? 'User Administration' : 
                currentView === 'diagnostics' ? 'System Diagnostics' : 'Observability Stack'}
            </h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-2xl font-medium leading-relaxed">
               {currentView === 'topology' 
                  ? 'Hierarchical structural mapping of physical domains and technical node relationships.'
                  : currentView === 'inbox'
                  ? 'Unified device lifecycle management and real-time telemetry orchestration.'
                  : currentView === 'automations'
                  ? 'Local event-driven logic workbench for reactive edge behaviors.'
                  : currentView === 'ha-settings'
                  ? 'Core bridge configuration for Home Assistant integration and credential lifecycle.'
                  : currentView === 'users'
                  ? 'Security policy enforcement and role-based access control for edge operators.'
                  : currentView === 'diagnostics'
                  ? 'Real-time telemetry and health diagnostics for resilient system operations.'
                  : 'Immutable audit trails and tactical technical history for system auditing.'
               }
            </p>
          </div>
        </header>
        
        <section className="flex-1 overflow-y-auto p-4 sm:p-8 relative">
           <div className="max-w-7xl mx-auto w-full">
            {currentView === 'topology' && <TopologyView />}
            {currentView === 'inbox' && <InboxView />}
            {currentView === 'automations' && <AutomationWorkbenchView />}
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
