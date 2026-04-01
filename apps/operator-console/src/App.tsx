import React, { useState } from 'react';
import { Network, Server, PlaySquare, Settings, ShieldAlert, Cpu } from 'lucide-react';
import { TopologyView } from './views/TopologyView';
import { InboxView } from './views/InboxView';

function App() {
  const [currentView, setCurrentView] = useState<'topology' | 'inbox'>('topology');

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
            <li>
              <a 
                href="#" 
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  currentView === 'topology' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={(e) => { e.preventDefault(); setCurrentView('topology'); }}
              >
                <Network className="w-4 h-4" />
                Topology
              </a>
            </li>
            <li>
              <a 
                href="#" 
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  currentView === 'inbox' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                onClick={(e) => { e.preventDefault(); setCurrentView('inbox'); }}
              >
                <Server className="w-4 h-4" />
                Inbox & Devices
              </a>
            </li>
            <li>
              <a 
                href="#" 
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-40 cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                <PlaySquare className="w-4 h-4" />
                Automations
              </a>
            </li>
            <li>
              <a 
                href="#" 
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground opacity-40 cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                <ShieldAlert className="w-4 h-4" />
                Audit Logs
              </a>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t mt-auto">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full p-2.5 rounded-lg hover:bg-muted font-medium">
            <Settings className="w-4 h-4" />
            System Settings
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="border-b px-8 py-7 bg-card/60 backdrop-blur-sm">
          <h1 className="text-2xl font-bold tracking-tight">
             {currentView === 'topology' ? 'Topology View' : 'Device Inbox & Manager'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
             {currentView === 'topology' 
                ? 'Read-only hierarchy of assigned physical layout and structural domains.'
                : 'Manage device lifecycle, view pending unassigned nodes and monitor active telemetry.'
             }
          </p>
        </header>
        
        <section className="flex-1 overflow-y-auto p-8 relative">
          {currentView === 'topology' && <TopologyView />}
          {currentView === 'inbox' && <InboxView />}
        </section>
      </main>
    </div>
  );
}

export default App;
