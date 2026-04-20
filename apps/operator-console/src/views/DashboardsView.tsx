import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, LayoutDashboard, Zap, Sparkles,
  Home, PlaySquare, Cpu, PenLine, Check, X, ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const API = `${API_BASE_URL}/api/v1`;

// ─── Domain Types ──────────────────────────────────────────────────────────────

interface DashboardWidget {
  id: string;
  type: 'room_summary' | 'selected_device' | 'scenes_shortcut' | 'assistant_insights' | 'energy_insight';
  config: Record<string, unknown>;
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

const WIDGET_META: Record<DashboardWidget['type'], { labelKey: string; icon: React.FC<{ className?: string }>; accent: string; descriptionKey: string }> = {
  room_summary:       { labelKey: 'dashboards.widgets.room_summary.label',        icon: Home,             accent: 'blue',    descriptionKey: 'dashboards.widgets.room_summary.description' },
  selected_device:    { labelKey: 'dashboards.widgets.selected_device.label',     icon: Cpu,              accent: 'violet',  descriptionKey: 'dashboards.widgets.selected_device.description' },
  scenes_shortcut:    { labelKey: 'dashboards.widgets.scenes_shortcut.label',     icon: PlaySquare,       accent: 'emerald', descriptionKey: 'dashboards.widgets.scenes_shortcut.description' },
  assistant_insights: { labelKey: 'dashboards.widgets.assistant_insights.label',  icon: Sparkles,         accent: 'amber',   descriptionKey: 'dashboards.widgets.assistant_insights.description' },
  energy_insight:     { labelKey: 'dashboards.widgets.energy_insight.label',      icon: Zap,              accent: 'orange',  descriptionKey: 'dashboards.widgets.energy_insight.description' },
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
  const { t } = useTranslation();
  const meta = WIDGET_META[widget.type];
  const Icon = meta.icon;
  const accentCls = ACCENT_STYLES[meta.accent];

  return (
    <div className="group relative flex items-start gap-4 p-5 rounded-2xl bg-card border border-border/60 hover:border-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300">
      <div className={cn('p-2.5 rounded-xl border shrink-0', accentCls)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{t(meta.labelKey)}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{t(meta.descriptionKey)}</p>
      </div>
      <button
        onClick={onRemove}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        title={t('dashboards.remove_widget')}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Empty States ─────────────────────────────────────────────────────────────

function EmptyDashboards({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] gap-8 text-center select-none animate-in fade-in duration-700">
      {/* Icon cluster */}
      <div className="relative">
        <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
          <LayoutDashboard className="w-12 h-12 text-primary/50" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/40">
          <Plus className="w-5 h-5 text-primary-foreground" />
        </div>
        {/* Ambient glow */}
        <div className="absolute inset-0 rounded-[2.5rem] bg-primary/5 blur-2xl -z-10 scale-150" />
      </div>

      {/* Copy */}
      <div className="space-y-3 max-w-sm">
        <h3 className="text-2xl font-black text-foreground tracking-tight">{t('dashboards.empty_title')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('dashboards.empty_description')}</p>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{t('dashboards.empty_value_hint')}</p>
      </div>

      {/* Value pillars */}
      <div className="flex items-center gap-6 flex-wrap justify-center">
          {([
          { icon: Home,     labelKey: 'topology.rooms' },
          { icon: Cpu,      labelKey: 'nav.system_devices' },
          { icon: Sparkles, labelKey: 'nav.assistant' },
        ] as { icon: React.FC<{ className?: string }>; labelKey: string }[]).map(({ icon: Icon, labelKey }) => (
          <div key={labelKey} className="flex items-center gap-2 text-muted-foreground/50">
            <Icon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-black uppercase tracking-widest">{t(labelKey)}</span>
          </div>
        ))}
      </div>

      <Button variant="primary" onClick={onCreate} className="flex items-center gap-2 px-8 py-3 text-sm">
        <Plus className="w-4 h-4" />
        {t('dashboards.action_create')}
      </Button>
    </div>
  );
}

function EmptyTabs({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] gap-5 text-center border border-dashed border-border/50 rounded-2xl bg-muted/5 p-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <PenLine className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <div className="space-y-1.5 max-w-xs">
        <p className="text-sm font-bold text-foreground/70">{t('dashboards.tabs_empty')}</p>
        <p className="text-xs text-muted-foreground/60 leading-relaxed">{t('dashboards.tabs_hint')}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={onAdd} className="flex items-center gap-2">
        <Plus className="w-3.5 h-3.5" />
        {t('dashboards.action_add_tab')}
      </Button>
    </div>
  );
}

function EmptyWidgets({ onAdd }: { onAdd: (type: DashboardWidget['type']) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center justify-center min-h-[160px] gap-3 text-center border border-dashed border-border/40 rounded-2xl bg-muted/5 p-6">
        <Sparkles className="w-7 h-7 text-muted-foreground/25" />
        <p className="text-xs text-muted-foreground/50">{t('dashboards.widgets_empty')}</p>
      </div>
      <WidgetPicker onAdd={onAdd} />
    </div>
  );
}

// ─── Widget Picker ────────────────────────────────────────────────────────────

function WidgetPicker({ onAdd }: { onAdd: (type: DashboardWidget['type']) => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">{t('dashboards.action_add_widget')}</p>
        <div className="h-px flex-1 bg-border/40" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SUPPORTED_WIDGETS.map(type => {
          const meta = WIDGET_META[type];
          const Icon = meta.icon;
          const accentCls = ACCENT_STYLES[meta.accent];
          return (
            <button
              key={type}
              onClick={() => onAdd(type)}
              className="group flex items-center gap-3 p-4 rounded-2xl bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 text-left active:scale-95"
            >
              <div className={cn('p-2 rounded-xl border shrink-0 group-hover:scale-110 transition-transform duration-200', accentCls)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t(meta.labelKey)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{t(meta.descriptionKey)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Inline Tab Creator ───────────────────────────────────────────────────────

function InlineTabCreator({ onConfirm, onCancel, placeholder }: { onConfirm: (title: string) => void; onCancel: () => void; placeholder: string }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleConfirm = () => { if (value.trim()) onConfirm(value.trim()); };

  return (
    <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl bg-primary/10 border border-primary/30 animate-in zoom-in-95 duration-150">
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleConfirm(); if (e.key === 'Escape') onCancel(); }}
        placeholder={placeholder}
        className="w-28 bg-transparent text-xs font-bold text-foreground outline-none placeholder:text-muted-foreground/50"
      />
      <button onClick={handleConfirm} disabled={!value.trim()} className="p-0.5 rounded-md text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors">
        <Check className="w-3 h-3" />
      </button>
      <button onClick={onCancel} className="p-0.5 rounded-md text-muted-foreground hover:bg-muted transition-colors">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function DashboardsView() {
  const { t } = useTranslation();
  const [dashboards, setDashboards]     = useState<Dashboard[]>([]);
  const [active, setActive]             = useState<Dashboard | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [creating, setCreating]         = useState(false);
  const [newTitle, setNewTitle]         = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle]     = useState('');
  const [addingTab, setAddingTab]       = useState(false);

  const fetchDashboards = useCallback(async (isInitial = false) => {
    try {
      const res = await apiFetch(`${API}/dashboards`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDashboards(data);
          if (data.length > 0) {
            if (isInitial) {
              setActive(data[0]);
              setActiveTabIdx(0);
            } else {
              const current = data.find(d => d.id === active?.id);
              if (current) setActive(current);
            }
          }
        } else {
          console.error('[DashboardsView] Expected array of dashboards but received:', data);
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [active?.id]);

  useEffect(() => { fetchDashboards(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (id: string, body: Partial<Dashboard>) => {
    const res = await apiFetch(`${API}/dashboards/${id}`, {
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
    const res = await apiFetch(`${API}/dashboards`, {
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

  const handleAddTab = async (title: string) => {
    if (!active || !title.trim()) return;
    setAddingTab(false);
    await patch(active.id, { tabs: [...active.tabs, { id: crypto.randomUUID(), title: title.trim(), widgets: [] }] });
    setActiveTabIdx(active.tabs.length);
  };

  const handleDeleteTab = async (tabIdx: number) => {
    if (!active) return;
    if (!window.confirm(t('dashboards.delete_tab_confirm'))) return;
    const updatedTabs = active.tabs.filter((_, idx) => idx !== tabIdx);
    await patch(active.id, { tabs: updatedTabs });
    setActiveTabIdx(Math.max(0, activeTabIdx - 1));
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
    await apiFetch(`${API}/dashboards/${id}`, { method: 'DELETE' });
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
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest animate-pulse">{t('dashboards.loading')}</p>
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
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2" />
        </div>
        <div className="relative z-10 p-5 sm:p-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/25 shrink-0">
              <LayoutDashboard className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/70 mb-1 truncate">{t('dashboards.category')}</p>
              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">{t('dashboards.title')}</h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate sm:whitespace-normal">{t('dashboards.intro_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
              <Cpu className="w-3 h-3 text-primary/60" />
              <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">{t('dashboards.personal_label')}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-pulse" />
            </div>
            {!creating && (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">{t('dashboards.action_new')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {creating && (
        <div className="mb-6 p-5 rounded-2xl bg-card border border-primary/30 shadow-lg shadow-primary/5 animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-3">{t('dashboards.action_new')}</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              autoFocus
              className="flex-1 bg-background border border-border rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-primary transition-colors"
              placeholder={t('dashboards.placeholder_title')}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="primary" onClick={handleCreate} className="flex-1 flex items-center justify-center gap-2">
                <Check className="w-4 h-4" /> {t('common.confirm')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setCreating(false); setNewTitle(''); }} className="flex items-center justify-center">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">

          <nav className="flex flex-col gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 px-1 mb-2">{t('dashboards.personal_label')}</p>
            <div className="flex flex-col gap-2">
              {Array.isArray(dashboards) && dashboards.map(d => {
                const isActive = active?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setActive(d); setActiveTabIdx(0); setEditingTitle(false); }}
                    className={cn(
                      'group flex items-center gap-3 p-3.5 rounded-2xl text-left transition-all duration-200 border',
                      isActive
                        ? 'bg-primary/10 border-primary/30 shadow-inner shadow-primary/5'
                        : 'bg-card border-border/50 hover:bg-muted/50 hover:border-border'
                    )}
                  >
                    <div className={cn(
                      'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200',
                      isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' : 'bg-muted text-muted-foreground/50'
                    )}>
                      <LayoutDashboard className="w-3.5 h-3.5" />
                    </div>
                    <span className={cn(
                      'flex-1 text-sm font-bold truncate transition-colors',
                      isActive ? 'text-primary' : 'text-foreground'
                    )}>{d.title}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary/40 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* ── Dashboard Editor (main) ── */}
          {active && (
            <div className="flex flex-col gap-6">

              {/* Dashboard title + delete */}
              <div className="flex items-center justify-between gap-4">
                {editingTitle ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      autoFocus
                      className="text-xl sm:text-2xl font-black bg-transparent border-b-2 border-primary outline-none flex-1 text-foreground py-0.5 min-w-0"
                      value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setEditingTitle(false); }}
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={handleRenameConfirm} className="p-1.5 rounded-lg text-primary hover:bg-primary/10"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingTitle(false)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-1 group min-w-0">
                    <h3 className="text-xl sm:text-2xl font-black text-foreground tracking-tight truncate">{active.title}</h3>
                    <button
                      onClick={() => { setDraftTitle(active.title); setEditingTitle(true); }}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
                      title={t('dashboards.rename')}
                    >
                      <PenLine className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  onClick={() => handleDelete(active.id)}
                  className="p-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                  title={t('dashboards.delete')}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* ── Tabs ── */}
              {active.tabs.length === 0 ? (
                <EmptyTabs onAdd={() => setAddingTab(true)} />
              ) : (
                <div className="flex flex-col gap-6">
                  {/* Tab strip container with horizontal scroll */}
                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border/60 pb-0 -mb-px">
                    {Array.isArray(active.tabs) && active.tabs.map((tab, idx) => (
                      <div key={tab.id} className="group/tab relative flex items-center">
                        <button
                          onClick={() => setActiveTabIdx(idx)}
                          className={cn(
                            'px-5 py-3 text-xs font-black uppercase tracking-widest rounded-t-xl transition-all duration-200 border-b-2',
                            activeTabIdx === idx
                              ? 'text-primary border-primary bg-primary/5'
                              : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50'
                          )}
                        >
                          {tab.title}
                        </button>
                        {/* Tab delete — only visible on hover, only for inactive or if >1 tab */}
                        {active.tabs.length > 1 && (
                          <button
                            onClick={() => handleDeleteTab(idx)}
                            className="absolute -top-1 -right-1 opacity-0 group-hover/tab:opacity-100 w-4 h-4 rounded-full bg-destructive/80 text-white flex items-center justify-center transition-opacity hover:bg-destructive"
                            title={t('dashboards.delete_tab_confirm')}
                          >
                            <X className="w-2 h-2" />
                          </button>
                        )}
                      </div>
                    ))}

                    {/* Inline tab creator or add button */}
                    {addingTab ? (
                      <InlineTabCreator
                        placeholder={t('dashboards.create_tab_placeholder')}
                        onConfirm={handleAddTab}
                        onCancel={() => setAddingTab(false)}
                      />
                    ) : (
                      <button
                        onClick={() => setAddingTab(true)}
                        className="flex items-center gap-1 px-3 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground/40 hover:text-primary transition-colors rounded-t-xl hover:bg-primary/5 border-b-2 border-transparent"
                      >
                        <Plus className="w-3 h-3" />
                        {t('dashboards.action_add_tab')}
                      </button>
                    )}
                  </div>

                  {/* ── Widgets ── */}
                  {activeTab && (
                    <div className="flex flex-col gap-6 pt-2">
                      {activeTab.widgets.length === 0 ? (
                        <EmptyWidgets onAdd={handleAddWidget} />
                      ) : (
                        <>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {Array.isArray(activeTab.widgets) && activeTab.widgets.map(w => (
                              <WidgetCard key={w.id} widget={w} onRemove={() => handleRemoveWidget(w.id)} />
                            ))}
                          </div>
                          <WidgetPicker onAdd={handleAddWidget} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
