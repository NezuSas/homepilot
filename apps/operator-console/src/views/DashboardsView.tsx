import React, { useEffect, useState, useCallback } from 'react';
import {
  Plus, Trash2, LayoutDashboard, ChevronRight, Zap, Sparkles,
  Home, PlaySquare, Cpu, PenLine, Check, X
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const API = `${API_BASE_URL}/api/v1`;

// ─── Domain Types ──────────────────────────────────────────────────────────────

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

// ─── Widget Metadata ──────────────────────────────────────────────────────────

const WIDGET_META: Record<DashboardWidget['type'], { label: string; icon: React.FC<any>; accent: string; description: string }> = {
  room_summary:       { label: 'Room Summary',        icon: Home,             accent: 'blue',    description: 'Status overview of a room' },
  selected_device:    { label: 'Device Card',         icon: Cpu,              accent: 'violet',  description: 'Control an individual device' },
  scenes_shortcut:    { label: 'Scene Shortcut',      icon: PlaySquare,       accent: 'emerald', description: 'Quick access to a scene' },
  assistant_insights: { label: 'Assistant Insights',  icon: Sparkles,         accent: 'amber',   description: 'Proactive system insights' },
  energy_insight:     { label: 'Energy Insight',      icon: Zap,              accent: 'orange',  description: 'Real-time energy signals' },
};

const SUPPORTED_WIDGETS = Object.keys(WIDGET_META) as DashboardWidget['type'][];

const ACCENT_STYLES: Record<string, string> = {
  blue:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  violet:  'bg-violet-500/10 text-violet-400 border-violet-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  amber:   'bg-amber-500/10 text-amber-400 border-amber-500/20',
  orange:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

// ─── Widget Card ──────────────────────────────────────────────────────────────

function WidgetCard({ widget, onRemove }: { widget: DashboardWidget; onRemove: () => void }) {
  const meta = WIDGET_META[widget.type];
  const Icon = meta.icon;
  const accentCls = ACCENT_STYLES[meta.accent];

  return (
    <div className="group relative flex items-start gap-4 p-5 rounded-2xl bg-card border border-border/60 hover:border-border hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <div className={cn('p-2.5 rounded-xl border shrink-0', accentCls)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{meta.label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title="Remove widget"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyDashboards({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] gap-6 text-center select-none">
      <div className="relative">
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
          <LayoutDashboard className="w-10 h-10 text-primary/60" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
          <Plus className="w-4 h-4 text-primary-foreground" />
        </div>
      </div>
      <div className="space-y-2 max-w-xs">
        <h3 className="text-xl font-black text-foreground tracking-tight">Your Space, Your Way</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Create personalized dashboards with the devices, rooms, and insights that matter to you.
        </p>
      </div>
      <Button variant="primary" onClick={onCreate} className="flex items-center gap-2 px-6">
        <Plus className="w-4 h-4" />
        Create your first dashboard
      </Button>
    </div>
  );
}

function EmptyTabs({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] gap-4 text-center border border-dashed border-border/60 rounded-2xl bg-muted/5">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center">
        <PenLine className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <div className="space-y-1 max-w-xs">
        <p className="text-sm font-bold text-foreground/70">No tabs yet</p>
        <p className="text-xs text-muted-foreground">Tabs let you organize your dashboard into distinct sections.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onAdd} className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5" />
        Add a tab
      </Button>
    </div>
  );
}

function EmptyWidgets({ onAdd }: { onAdd: (type: DashboardWidget['type']) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center min-h-[180px] gap-3 text-center border border-dashed border-border/60 rounded-2xl bg-muted/5">
        <Sparkles className="w-8 h-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">This tab is empty. Add your first widget below.</p>
      </div>
      <WidgetPicker onAdd={onAdd} />
    </div>
  );
}

// ─── Widget Picker ────────────────────────────────────────────────────────────

function WidgetPicker({ onAdd }: { onAdd: (type: DashboardWidget['type']) => void }) {
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">Add Widget</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SUPPORTED_WIDGETS.map(type => {
          const meta = WIDGET_META[type];
          const Icon = meta.icon;
          const accentCls = ACCENT_STYLES[meta.accent];
          return (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="group flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left"
            >
              <div className={cn('p-2 rounded-xl border shrink-0 group-hover:scale-110 transition-transform duration-200', accentCls)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{meta.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{meta.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DashboardsView() {
  const [dashboards, setDashboards]     = useState<Dashboard[]>([]);
  const [active, setActive]             = useState<Dashboard | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle]     = useState('');

  // Fixed data fetching to avoid infinite loops
  const fetchDashboards = useCallback(async (isInitial = false) => {
    try {
      const res = await fetch(`${API}/dashboards`);
      if (res.ok) {
        const data: Dashboard[] = await res.json();
        setDashboards(data);
        
        // Only auto-select active on initial load or if we lost the active one
        if (data.length > 0) {
          if (isInitial || !active) {
            setActive(data[0]);
            setActiveTabIdx(0);
          } else {
            // Update active from current results to keep fresh Data
            const current = data.find(d => d.id === active.id);
            if (current) setActive(current);
          }
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [active?.id]); // Use active.id for better stability

  useEffect(() => {
    fetchDashboards(true);
  }, []); // Run once on mount

  const patch = async (id: string, body: Partial<Dashboard>) => {
    const res = await fetch(`${API}/dashboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      const updated: Dashboard = await res.json();
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      setActive(updated);
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
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
      setCreating(false);
    }
  };

  const handleRenameConfirm = async () => {
    if (!active || !draftTitle.trim()) { setEditingTitle(false); return; }
    await patch(active.id, { title: draftTitle.trim() });
    setEditingTitle(false);
  };

  const handleAddTab = async () => {
    if (!active) return;
    const tabTitle = prompt('Tab name:');
    if (!tabTitle) return;
    await patch(active.id, { tabs: [...active.tabs, { id: crypto.randomUUID(), title: tabTitle, widgets: [] }] });
  };

  const handleAddWidget = async (type: DashboardWidget['type']) => {
    if (!active || active.tabs.length === 0) return;
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: [...tab.widgets, { id: crypto.randomUUID(), type, config: {} }] }
    );
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: tab.widgets.filter(w => w.id !== widgetId) }
    );
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleDelete = async (id: string) => {
    await fetch(`${API}/dashboards/${id}`, { method: 'DELETE' });
    const remaining = dashboards.filter(d => d.id !== id);
    setDashboards(remaining);
    setActive(remaining.length > 0 ? remaining[0] : null);
    setActiveTabIdx(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary/40 animate-pulse" />
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest animate-pulse">Loading your dashboards</p>
        </div>
      </div>
    );
  }

  const activeTab = active?.tabs[activeTabIdx];

  return (
    <div className="flex flex-col gap-0 animate-in fade-in duration-700 min-h-full">

      {/* ── Page Identity Banner ─────────────────────────────────────── */}
      <div className="relative rounded-3xl overflow-hidden mb-8 border border-border/60 bg-gradient-to-br from-card via-card to-primary/5">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        </div>
        <div className="relative z-10 p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/30 shrink-0">
              <LayoutDashboard className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1">Personal Dashboards</p>
              <h2 className="text-2xl font-black text-foreground tracking-tight">My Spaces</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Custom views tailored to your workflow and preferences.</p>
            </div>
          </div>
          {!creating && (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="flex items-center gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              New Dashboard
            </Button>
          )}
        </div>
      </div>

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {creating && (
        <div className="mb-6 p-5 rounded-2xl bg-card border border-primary/30 shadow-lg shadow-primary/5 animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3">New Dashboard</p>
          <div className="flex items-center gap-3">
            <input
              autoFocus
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
              placeholder="Dashboard title..."
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
            />
            <Button size="sm" variant="primary" onClick={handleCreate} className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Create
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewTitle(''); }} className="flex items-center gap-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">

          {/* ── Dashboard List (left rail) ── */}
          <nav className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 px-1 mb-1">Dashboards</p>
            {dashboards.map(d => {
              const isActive = active?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => { setActive(d); setActiveTabIdx(0); setEditingTitle(false); }}
                  className={cn(
                    'group flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all duration-200 border',
                    isActive
                      ? 'bg-primary/10 border-primary/30 text-primary shadow-inner shadow-primary/10'
                      : 'bg-card border-border/60 text-foreground hover:bg-muted/60 hover:border-border'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all', isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'bg-muted text-muted-foreground')}>
                    <LayoutDashboard className="w-3.5 h-3.5" />
                  </div>
                  <span className="flex-1 text-sm font-bold truncate">{d.title}</span>
                  {isActive && <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />}
                </button>
              );
            })}
          </nav>

          {/* ── Dashboard Editor (main) ── */}
          {active && (
            <div className="flex flex-col gap-6">

              {/* Dashboard title */}
              <div className="flex items-center justify-between gap-4">
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      className="text-2xl font-black bg-transparent border-b-2 border-primary outline-none flex-1 text-foreground py-0.5"
                      value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setEditingTitle(false); }}
                    />
                    <button onClick={handleRenameConfirm} className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-1 group">
                    <h3 className="text-2xl font-black text-foreground tracking-tight">{active.title}</h3>
                    <button
                      onClick={() => { setDraftTitle(active.title); setEditingTitle(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                      title="Rename"
                    >
                      <PenLine className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(active.id)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title="Delete dashboard"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* ── Tabs ── */}
              {active.tabs.length === 0 ? (
                <EmptyTabs onAdd={handleAddTab} />
              ) : (
                <>
                  <div className="flex items-center gap-1.5 flex-wrap border-b border-border/60 pb-0 -mb-px">
                    {active.tabs.map((tab, idx) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTabIdx(idx)}
                        className={cn(
                          'relative px-5 py-3 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all duration-200 border-b-2',
                          activeTabIdx === idx
                            ? 'text-primary border-primary bg-primary/5'
                            : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                        )}
                      >
                        {tab.title}
                      </button>
                    ))}
                    <button
                      onClick={handleAddTab}
                      className="flex items-center gap-1 px-3 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground/50 hover:text-primary transition-colors rounded-t-xl hover:bg-primary/5 border-b-2 border-transparent"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add tab
                    </button>
                  </div>

                  {/* ── Widgets ── */}
                  {activeTab && (
                    <div className="flex flex-col gap-6 pt-2">
                      {activeTab.widgets.length === 0 ? (
                        <EmptyWidgets onAdd={handleAddWidget} />
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {activeTab.widgets.map(w => (
                              <WidgetCard key={w.id} widget={w} onRemove={() => handleRemoveWidget(w.id)} />
                            ))}
                          </div>
                          <WidgetPicker onAdd={handleAddWidget} />
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
