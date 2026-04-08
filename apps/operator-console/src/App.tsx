import { useState, type ReactNode } from 'react';
import { Network, Server, PlaySquare, Settings, ShieldAlert, Cpu, Activity } from 'lucide-react';
import { TopologyView } from './views/TopologyView';
import { InboxView } from './views/InboxView';
import { AutomationWorkbenchView } from './views/AutomationWorkbenchView';
import { AuditLogsView } from './views/AuditLogsView';
import { HomeAssistantSettingsView } from './views/HomeAssistantSettingsView';
import { DiagnosticsView } from './views/DiagnosticsView';

/**
 * Union de vistas posibles para tipado estricto.
 */
type View = 'topology' | 'inbox' | 'automations' | 'audit-logs' | 'ha-settings' | 'diagnostics';

/**
 * App Component
 * Aplicación principal de la Operator Console V1.
 * Gestiona el enrutamiento básico y el layout global.
 */
function App() {
  const [currentView, setCurrentView] = useState<View>('topology');

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
        </section>
      </main>
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
