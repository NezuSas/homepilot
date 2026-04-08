import { useState, useEffect, type ReactNode } from 'react';
import { Network, Server, PlaySquare, Settings, ShieldAlert, Cpu, Activity, KeyRound, Monitor, Users } from 'lucide-react';
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

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/40 flex flex-col flex-shrink-0">
        <div className="p-6 border-b flex flex-col gap-1">
          <div className="flex items-center gap-2 text-primary">
            <Cpu className="w-5 h-5" />
            <h2 className="font-semibold tracking-tight text-lg">HomePilot Edge</h2>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">Operator Console V1</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="grid gap-1 px-3">
            <NavItem 
              icon={<Network className="w-4 h-4" />} 
              label="Topology" 
              active={currentView === 'topology'} 
              onClick={() => setCurrentView('topology')} 
            />
            <NavItem 
              icon={<Server className="w-4 h-4" />} 
              label="Inbox & Devices" 
              active={currentView === 'inbox'} 
              onClick={() => setCurrentView('inbox')} 
            />
            <NavItem 
              icon={<PlaySquare className="w-4 h-4" />} 
              label="Automations" 
              active={currentView === 'automations'} 
              onClick={() => setCurrentView('automations')} 
            />
            <NavItem 
              icon={<ShieldAlert className="w-4 h-4" />} 
              label="Audit Logs" 
              active={currentView === 'audit-logs'}
              onClick={() => setCurrentView('audit-logs')}
            />
          </ul>
        </nav>
        
        <div className="p-4 border-t mt-auto flex flex-col gap-2">
          <button 
            onClick={() => setCurrentView('diagnostics')}
            className={`flex items-center gap-2 text-sm transition-colors w-full p-2.5 rounded-lg font-medium ${
              currentView === 'diagnostics' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Activity className="w-4 h-4" />
            Diagnostics
          </button>
          <button 
            onClick={() => setCurrentView('ha-settings')}
            className={`flex items-center gap-2 text-sm transition-colors w-full p-2.5 rounded-lg font-medium ${
              currentView === 'ha-settings' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Settings className="w-4 h-4" />
            HA Settings
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => setCurrentView('users')}
              className={`flex items-center gap-2 text-sm transition-colors w-full p-2.5 rounded-lg font-medium ${
                currentView === 'users' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Users className="w-4 h-4" />
              Users Management
            </button>
          )}
          
          <div className="pt-2 border-t mt-2">
            <div className="flex items-center justify-between p-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-none">{user?.username || 'user'}</span>
                <span className="text-[10px] text-muted-foreground uppercase mt-0.5">{user?.role || 'operator'}</span>
              </div>
              <div className="flex items-center">
                <button 
                  onClick={() => setShowPwdModal(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted text-sm"
                  title="Change Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-500/10 text-sm font-medium ml-1"
                  title="Log out"
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
        <header className="border-b px-8 py-7 bg-card/60 backdrop-blur-sm">
          <h1 className="text-2xl font-bold tracking-tight">
             {currentView === 'topology' ? 'Topology View' : 
              currentView === 'inbox' ? 'Device Inbox & Manager' : 
              currentView === 'automations' ? 'Automation Workbench' : 
              currentView === 'ha-settings' ? 'Home Assistant Settings' : 
              currentView === 'users' ? 'User Administration' : 
              currentView === 'diagnostics' ? 'System Diagnostics' : 'Audit Logs & Observability'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
             {currentView === 'topology' 
                ? 'Read-only hierarchy of assigned physical layout and structural domains.'
                : currentView === 'inbox'
                ? 'Manage device lifecycle, view pending unassigned nodes and monitor active telemetry.'
                : currentView === 'automations'
                ? 'Configure and monitor IF-THEN rules for reactive device behavior.'
                : currentView === 'ha-settings'
                ? 'Configure Home Assistant connection, manage hot-swap credentials and monitor bridge connectivity status.'
                : currentView === 'users'
                ? 'Create, manage or suspend Edge Operator accounts and enforce session access controls.'
                : currentView === 'diagnostics'
                ? 'Real-time operational health, resilience status and anomaly detection for system operators.'
                : 'Technical history of system events, commands and state transitions for debugging.'
             }
          </p>
        </header>
        
        <section className="flex-1 overflow-y-auto p-8 relative">
          {currentView === 'topology' && <TopologyView />}
          {currentView === 'inbox' && <InboxView />}
          {currentView === 'automations' && <AutomationWorkbenchView />}
          {currentView === 'audit-logs' && <AuditLogsView />}
          {currentView === 'ha-settings' && <HomeAssistantSettingsView />}
          {currentView === 'diagnostics' && <DiagnosticsView />}
          {currentView === 'users' && <UsersView />}
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
