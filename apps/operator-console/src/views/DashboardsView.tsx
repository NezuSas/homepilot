import { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, LayoutDashboard,
  PenLine, Check, X, ChevronRight
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
import type { Dashboard, DashboardWidget, WidgetType, DashboardWidgetConfig } from './dashboards/types';
import { DashboardCanvas } from './dashboards/DashboardCanvas';
import { WidgetInspector } from './dashboards/WidgetInspector';
import { generateId } from '../utils/generateId';

const API = `${API_BASE_URL}/api/v1`;

// ─── Shared Components ────────────────────────────────────────────────────────

function EmptyDashboards({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] gap-8 text-center select-none animate-in fade-in duration-700">
      <div className="relative">
        <div className="w-28 h-28 rounded-[2.5rem] bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 flex items-center justify-center shadow-2xl shadow-primary/10">
          <LayoutDashboard className="w-12 h-12 text-primary/50" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/40">
          <Plus className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="absolute inset-0 rounded-[2.5rem] bg-primary/5 blur-2xl -z-10 scale-150" />
      </div>
      <div className="space-y-3 max-w-sm">
        <h3 className="text-2xl font-black text-foreground tracking-tight">{t('dashboards.empty_title')}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{t('dashboards.empty_description')}</p>
      </div>
      <Button variant="primary" onClick={onCreate} className="flex items-center gap-2 px-8 py-3 text-sm">
        <Plus className="w-4 h-4" />
        {t('dashboards.action_create')}
      </Button>
    </div>
  );
}

function InlineTabCreator({ onConfirm, onCancel, placeholder, initialValue = '' }: { onConfirm: (title: string) => void; onCancel: () => void; placeholder: string, initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
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

  const [isEditing, setIsEditing] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);

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
        }
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [active?.id]);

  useEffect(() => { 
    fetchDashboards(true);
  }, []); // Run ONLY once on mount.

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
    const newTabId = generateId();
    await patch(active.id, { tabs: [...active.tabs, { id: newTabId, title: title.trim(), widgets: [] }] });
    setActiveTabIdx(active.tabs.length);
  };

  const handleDeleteTab = async (tabIdx: number) => {
    if (!active) return;
    if (!window.confirm(t('dashboards.delete_tab_confirm'))) return;
    const updatedTabs = active.tabs.filter((_, idx) => idx !== tabIdx);
    await patch(active.id, { tabs: updatedTabs });
    setActiveTabIdx(Math.max(0, activeTabIdx - 1));
  };

  const handleAddWidget = async (type: WidgetType) => {
    if (!active || active.tabs.length === 0) return;
    
    // Find a free spot (naive start at bottom)
    const currentTab = active.tabs[activeTabIdx];
    const maxY = currentTab.widgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);

    const defaultConfig: DashboardWidgetConfig = {
      layout: { x: 0, y: maxY, w: 4, h: 4 },
      binding: { entityId: '', entityType: 'device' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { variant: 'glass', title: '', showTitle: true }
    };
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: [...tab.widgets, { id: generateId(), type, config: defaultConfig }] }
    );
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleLayoutChange = async (updatedWidgets: DashboardWidget[]) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: updatedWidgets }
    );
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleRemoveWidget = async (widgetId: string) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: tab.widgets.filter(w => w.id !== widgetId) }
    );
    await patch(active.id, { tabs: updatedTabs });
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId(null);
      setIsInspectorOpen(false);
    }
  };

  const handleUpdateWidgetConfig = async (widgetId: string, newConfig: Partial<DashboardWidgetConfig>) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) => {
      if (idx !== activeTabIdx) return tab;
      return {
        ...tab,
        widgets: tab.widgets.map(w => {
          if (w.id !== widgetId) return w;
          return {
            ...w,
            config: {
              ...w.config,
              ...newConfig,
              appearance: { ...w.config.appearance, ...(newConfig.appearance || {}) },
              visibility: { ...w.config.visibility, ...(newConfig.visibility || {}) },
              binding: { ...w.config.binding, ...(newConfig.binding || {}) },
              layout: { ...w.config.layout, ...(newConfig.layout || {}) }
            }
          };
        })
      };
    });
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
        <div className="flex flex-col items-center gap-3 animate-pulse">
          <LayoutDashboard className="w-8 h-8 text-primary/40" />
          <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{t('dashboards.loading')}</p>
        </div>
      </div>
    );
  }

  const activeTab = active?.tabs[activeTabIdx];

  return (
    <div className="flex flex-col gap-0 animate-in fade-in duration-700 min-h-full pb-20">

      {/* ── Page Identity Banner ─────────────────────────────────────── */}
      <div className="relative rounded-[2.5rem] overflow-hidden mb-8 border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/4 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/2" />
        </div>
        <div className="relative z-10 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 min-w-0">
            <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30 shrink-0">
              <LayoutDashboard className="w-8 h-8 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/70 mb-2">{t('dashboards.category')}</p>
              <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight truncate mb-1">{t('dashboards.title')}</h2>
              <p className="text-xs text-muted-foreground/60 max-w-md">{t('dashboards.intro_subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {active && (
              <Button 
                variant={isEditing ? "primary" : "secondary"} 
                size="sm" 
                onClick={() => { setIsEditing(!isEditing); if (isEditing) { setIsInspectorOpen(false); setSelectedWidgetId(null); } }}
                className="flex items-center gap-2 px-6 rounded-2xl"
              >
                {isEditing ? <Check className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
                <span className="hidden xs:inline uppercase font-black text-[10px] tracking-widest">{isEditing ? t('common.done') : t('dashboards.action_edit')}</span>
              </Button>
            )}
            {!creating && !isEditing && (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)} className="flex items-center gap-2 px-6 rounded-2xl">
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline uppercase font-black text-[10px] tracking-widest">{t('dashboards.action_new')}</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {creating && (
        <div className="mb-6 p-6 rounded-3xl bg-card border border-primary/30 shadow-2xl shadow-primary/10 animate-in slide-in-from-top-4 duration-500">
          <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">{t('dashboards.action_new')}</p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <input
              autoFocus
              className="flex-1 bg-background border border-border/80 rounded-2xl px-5 py-3 text-sm font-bold focus:outline-none focus:border-primary transition-all shadow-inner"
              placeholder={t('dashboards.placeholder_title')}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setNewTitle(''); } }}
            />
            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleCreate} className="flex-1 font-black uppercase tracking-widest text-[10px] px-8">{t('common.confirm')}</Button>
              <Button variant="secondary" onClick={() => { setCreating(false); setNewTitle(''); }} className="p-3"><X className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">

          {/* Sidebar Nav */}
          <nav className="flex flex-col gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/30 px-2 mb-2">{t('dashboards.list_header')}</p>
            <div className="flex flex-col gap-2">
              {dashboards.map(d => {
                const isActive = active?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => { setActive(d); setActiveTabIdx(0); setEditingTitle(false); setIsEditing(false); }}
                    className={cn(
                      'group flex items-center gap-4 p-4 rounded-3xl text-left transition-all duration-300 border',
                      isActive
                        ? 'bg-primary/5 border-primary/20 shadow-inner'
                        : 'bg-card border-border/40 hover:bg-muted/40 hover:border-border'
                    )}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300',
                      isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-muted text-muted-foreground/30 group-hover:scale-110'
                    )}>
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <span className={cn('flex-1 text-sm font-bold truncate', isActive ? 'text-primary' : 'text-foreground')}>{d.title}</span>
                    {isActive && <ChevronRight className="w-4 h-4 text-primary/30" />}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Dashboard Area */}
          {active && (
            <div className="flex flex-col gap-8">
              {/* Header: Title + Delete */}
              <div className="flex items-center justify-between gap-4">
                {editingTitle ? (
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      autoFocus
                      className="text-2xl sm:text-3xl font-black bg-transparent border-b-2 border-primary outline-none flex-1 text-foreground py-1"
                      value={draftTitle}
                      onChange={e => setDraftTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(); if (e.key === 'Escape') setEditingTitle(false); }}
                    />
                    <button onClick={handleRenameConfirm} className="p-2 text-primary"><Check className="w-5 h-5" /></button>
                    <button onClick={() => setEditingTitle(false)} className="p-2 text-muted-foreground"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 group flex-1">
                    <h3 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">{active.title}</h3>
                    <button onClick={() => { setDraftTitle(active.title); setEditingTitle(true); }} className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-foreground transition-all"><PenLine className="w-4 h-4" /></button>
                  </div>
                )}
                {!isEditing && (
                  <button onClick={() => handleDelete(active.id)} className="p-3 bg-destructive/5 text-destructive rounded-2xl hover:bg-destructive hover:text-white transition-all"><Trash2 className="w-5 h-5" /></button>
                )}
              </div>

              {/* Tabs Nav */}
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-border/40 pb-0">
                {active.tabs.map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTabIdx(idx); setSelectedWidgetId(null); setIsInspectorOpen(false); }}
                    className={cn(
                      "px-6 py-4 text-xs font-black uppercase tracking-[0.2em] transition-all border-b-2 relative",
                      activeTabIdx === idx ? "text-primary border-primary bg-primary/[0.02]" : "text-muted-foreground/40 border-transparent hover:text-muted-foreground hover:bg-muted/20"
                    )}
                  >
                    {tab.title}
                    {isEditing && active.tabs.length > 1 && (
                      <div onClick={(e) => { e.stopPropagation(); handleDeleteTab(idx); }} className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-white rounded-full flex items-center justify-center scale-0 group-hover:scale-100 transition-transform">
                        <X className="w-2 h-2" />
                      </div>
                    )}
                  </button>
                ))}
                <button onClick={() => setAddingTab(true)} className="px-4 text-muted-foreground/30 hover:text-primary transition-colors"><Plus className="w-4 h-4" /></button>
                {addingTab && (
                  <InlineTabCreator placeholder={t('dashboards.placeholder_tab_title')} onConfirm={handleAddTab} onCancel={() => setAddingTab(false)} />
                )}
              </div>

              {/* Canvas Area */}
              {activeTab ? (
                <div className="relative flex flex-col gap-6">
                   <DashboardCanvas
                      widgets={activeTab.widgets}
                      isEditing={isEditing}
                      selectedWidgetId={selectedWidgetId}
                      onWidgetClick={(id) => { 
                        const widget = activeTab?.widgets.find(w => w.id === id);
                        const isUnconfigured = !widget?.config.binding.entityId;
                        if (!isEditing && !isUnconfigured) return;
                        if (!isEditing) setIsEditing(true);
                        setSelectedWidgetId(id); 
                        setIsInspectorOpen(true); 
                      }}
                      onLayoutChange={handleLayoutChange}
                   />
                   
                   {/* Editor Tools Footer (Sticky/Floating) */}
                   {isEditing && (
                     <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[250] animate-in slide-in-from-bottom-12 duration-500 w-full max-w-4xl px-4 pointer-events-none">
                        <div className="flex flex-col gap-3 p-4 rounded-[2rem] bg-background/85 backdrop-blur-2xl border border-primary/20 shadow-2xl shadow-primary/10 pointer-events-auto">
                           <div className="flex items-center justify-between px-2">
                              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('dashboards.editor.widget_management')}</p>
                              <button 
                                onClick={() => { setIsEditing(false); setIsInspectorOpen(false); setSelectedWidgetId(null); }} 
                                className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50"
                              >
                                {t('common.done')} <Check className="w-3 h-3" />
                              </button>
                           </div>
                           <div className="flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                              {(['device_control', 'room_overview', 'scene_shortcut', 'activity_feed', 'assistant_insight', 'system_status'] as WidgetType[]).map(type => (
                                <button
                                   key={type}
                                   onClick={() => handleAddWidget(type)}
                                   className="shrink-0 px-4 py-2 bg-card border border-border/80 hover:bg-primary/5 hover:border-primary/40 hover:text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm"
                                >
                                  + {t(`dashboards.editor.add_${type}`, { defaultValue: type })}
                                </button>
                              ))}
                           </div>
                        </div>
                     </div>
                   )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 bg-muted/20 rounded-3xl border border-dashed border-border/60">
                   <p className="text-xs text-muted-foreground italic">{t('common.no_content_yet')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inspector Sidebar Overlay */}
      <WidgetInspector
        widget={activeTab?.widgets.find(w => w.id === selectedWidgetId) || null}
        isOpen={isInspectorOpen && isEditing}
        onClose={() => setIsInspectorOpen(false)}
        onUpdate={handleUpdateWidgetConfig}
        onRemove={handleRemoveWidget}
      />
    </div>
  );
}
