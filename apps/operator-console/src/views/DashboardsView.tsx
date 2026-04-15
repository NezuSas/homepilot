import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, LayoutDashboard, ChevronRight, Zap, Sparkles, Home, PlaySquare } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { Button } from '../components/ui/Button';

const API = `${API_BASE_URL}/api/v1`;

// Widget type definitions
interface DashboardWidget {
  id: string;
  type: 'room_summary' | 'selected_device' | 'scenes_shortcut' | 'assistant_insights' | 'energy_insight';
  config: Record<string, any>;
}

interface DashboardTab {
  id: string;
  title: string;
  widgets: DashboardWidget[];
}

interface Dashboard {
  id: string;
  ownerId: string;
  title: string;
  visibility: { roles: string[]; users: string[]; homes: string[] };
  tabs: DashboardTab[];
  createdAt: string;
  updatedAt: string;
}

const WIDGET_ICON: Record<string, React.ReactNode> = {
  room_summary:       <Home className="w-5 h-5" />,
  selected_device:    <LayoutDashboard className="w-5 h-5" />,
  scenes_shortcut:    <PlaySquare className="w-5 h-5" />,
  assistant_insights: <Sparkles className="w-5 h-5" />,
  energy_insight:     <Zap className="w-5 h-5" />,
};

const WIDGET_LABEL: Record<string, string> = {
  room_summary:       'Room Summary',
  selected_device:    'Device Card',
  scenes_shortcut:    'Scenes Shortcut',
  assistant_insights: 'Assistant Insights',
  energy_insight:     'Energy Insight',
};

const SUPPORTED_WIDGETS: DashboardWidget['type'][] = [
  'room_summary',
  'selected_device',
  'scenes_shortcut',
  'assistant_insights',
  'energy_insight',
];

function WidgetCard({ widget, onRemove }: { widget: DashboardWidget; onRemove: () => void }) {
  return (
    <div className="group flex items-center gap-4 p-4 rounded-2xl bg-card border border-border/60 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
      <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
        {WIDGET_ICON[widget.type] || <LayoutDashboard className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground truncate">{WIDGET_LABEL[widget.type] || widget.type}</p>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-black opacity-50">Widget</p>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl text-destructive hover:bg-destructive/10"
        title="Remove widget"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

export function DashboardsView() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [active, setActive] = useState<Dashboard | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await fetch(`${API}/dashboards`);
      if (res.ok) {
        const data: Dashboard[] = await res.json();
        setDashboards(data);
        if (!active && data.length > 0) {
          setActive(data[0]);
          setActiveTabIdx(0);
        }
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { fetchDashboards(); }, [fetchDashboards]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(false);
    const res = await fetch(`${API}/dashboards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle.trim() })
    });
    if (res.ok) {
      const created: Dashboard = await res.json();
      setDashboards(prev => [...prev, created]);
      setActive(created);
      setActiveTabIdx(0);
      setNewTitle('');
    }
  };

  const handleAddTab = async () => {
    if (!active) return;
    const tabTitle = prompt('Tab name:');
    if (!tabTitle) return;
    const newTab: DashboardTab = {
      id: crypto.randomUUID(),
      title: tabTitle,
      widgets: []
    };
    const updatedTabs = [...active.tabs, newTab];
    const res = await fetch(`${API}/dashboards/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: updatedTabs })
    });
    if (res.ok) {
      const updated: Dashboard = await res.json();
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      setActive(updated);
      setActiveTabIdx(updatedTabs.length - 1);
    }
  };

  const handleAddWidget = async (type: DashboardWidget['type']) => {
    if (!active || active.tabs.length === 0) return;
    const updatedTabs = active.tabs.map((tab, idx) => {
      if (idx !== activeTabIdx) return tab;
      return {
        ...tab,
        widgets: [...tab.widgets, { id: crypto.randomUUID(), type, config: {} }]
      };
    });
    const res = await fetch(`${API}/dashboards/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: updatedTabs })
    });
    if (res.ok) {
      const updated: Dashboard = await res.json();
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      setActive(updated);
    }
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) => {
      if (idx !== activeTabIdx) return tab;
      return { ...tab, widgets: tab.widgets.filter(w => w.id !== widgetId) };
    });
    const res = await fetch(`${API}/dashboards/${active.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tabs: updatedTabs })
    });
    if (res.ok) {
      const updated: Dashboard = await res.json();
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      setActive(updated);
    }
  };

  const handleDelete = async (dashboardId: string) => {
    await fetch(`${API}/dashboards/${dashboardId}`, { method: 'DELETE' });
    const remaining = dashboards.filter(d => d.id !== dashboardId);
    setDashboards(remaining);
    setActive(remaining.length > 0 ? remaining[0] : null);
    setActiveTabIdx(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <span className="animate-pulse text-sm font-bold">Loading dashboards...</span>
      </div>
    );
  }

  const activeTab = active?.tabs[activeTabIdx];

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">My Dashboards</h2>
          <p className="text-xs text-muted-foreground opacity-50">Custom views for different users and roles.</p>
        </div>
        <Button size="sm" variant="primary" onClick={() => setCreating(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Dashboard
        </Button>
      </div>

      {/* Create form */}
      {creating && (
        <div className="flex items-center gap-3 p-4 bg-card border border-border/60 rounded-2xl animate-in slide-in-from-top-2 duration-300">
          <input
            autoFocus
            className="flex-1 bg-transparent border-b border-border/60 focus:border-primary outline-none text-sm font-bold py-1"
            placeholder="Dashboard title..."
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
          <Button size="sm" variant="primary" onClick={handleCreate}>Create</Button>
          <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewTitle(''); }}>Cancel</Button>
        </div>
      )}

      {/* Dashboard list + editor */}
      {dashboards.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border border-dashed border-border rounded-2xl bg-muted/10 gap-2">
          <LayoutDashboard className="w-8 h-8 opacity-30" />
          <p className="text-sm font-bold">No dashboards yet</p>
          <p className="text-xs opacity-50">Create your first dashboard to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          {/* Dashboard selector */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-1">Your Dashboards</p>
            {dashboards.map(d => (
              <button
                key={d.id}
                onClick={() => { setActive(d); setActiveTabIdx(0); }}
                className={`group flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 border ${active?.id === d.id ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border/60 text-foreground hover:bg-muted/80'}`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="flex-1 text-sm font-bold truncate">{d.title}</span>
                {active?.id === d.id && <ChevronRight className="w-4 h-4 opacity-50" />}
              </button>
            ))}
          </div>

          {/* Dashboard editor */}
          {active && (
            <div className="flex flex-col gap-6">
              {/* Dashboard header */}
              <div className="flex items-center justify-between gap-4">
                <h3 className="text-lg font-black text-foreground tracking-tight">{active.title}</h3>
                <button
                  onClick={() => handleDelete(active.id)}
                  className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                  title="Delete dashboard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {active.tabs.map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabIdx(idx)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTabIdx === idx ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    {tab.title}
                  </button>
                ))}
                <button
                  onClick={handleAddTab}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-muted-foreground hover:bg-muted/60 border border-dashed border-border/60 transition-all"
                >
                  <Plus className="w-3 h-3" /> Tab
                </button>
              </div>

              {/* Active tab content */}
              {activeTab ? (
                <div className="flex flex-col gap-4">
                  {/* Widgets */}
                  {activeTab.widgets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border border-dashed border-border/50 rounded-2xl">
                      <p className="text-xs font-bold opacity-50">No widgets yet. Add one below.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeTab.widgets.map(w => (
                        <WidgetCard key={w.id} widget={w} onRemove={() => handleRemoveWidget(w.id)} />
                      ))}
                    </div>
                  )}

                  {/* Add widget strip */}
                  <div className="mt-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 mb-3">Add Widget</p>
                    <div className="flex flex-wrap gap-2">
                      {SUPPORTED_WIDGETS.map(type => (
                        <button
                          key={type}
                          onClick={() => handleAddWidget(type)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold tracking-tight bg-muted hover:bg-primary/10 hover:text-primary border border-border/60 hover:border-primary/30 transition-all"
                        >
                          {WIDGET_ICON[type]}
                          {WIDGET_LABEL[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground opacity-50 text-center py-8">
                  Create a tab to start adding widgets.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
