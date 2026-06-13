import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { DashboardCreateForm } from '../components/DashboardCreateForm';
import { DashboardEditorToolbar } from '../components/DashboardEditorToolbar';
import { DashboardSidebarNav } from '../components/DashboardSidebarNav';
import { DashboardTabsNav } from '../components/DashboardTabsNav';
import { DashboardTitleBar } from '../components/DashboardTitleBar';
import { DashboardsHero } from '../components/DashboardsHero';
import { DashboardsLoadingState } from '../components/DashboardsLoadingState';
import { EmptyDashboards } from '../components/EmptyDashboards';
import type { Dashboard, DashboardWidget, WidgetType, DashboardWidgetConfig } from './dashboards/types';
import { DashboardCanvas } from './dashboards/DashboardCanvas';
import { WidgetInspector } from './dashboards/WidgetInspector';
import { generateId } from '../utils/generateId';

const API = `${API_BASE_URL}/api/v1`;

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
    return <DashboardsLoadingState label={t('dashboards.loading')} />;
  }

  const activeTab = active?.tabs[activeTabIdx];

  return (
    <div className="flex flex-col gap-0 animate-in fade-in duration-700 min-h-full pb-20">

      <DashboardsHero
        category={t('dashboards.category')}
        title={t('dashboards.title')}
        subtitle={t('dashboards.intro_subtitle')}
        canEdit={Boolean(active)}
        isEditing={isEditing}
        isCreating={creating}
        editLabel={t('dashboards.action_edit')}
        doneLabel={t('common.done')}
        newLabel={t('dashboards.action_new')}
        onToggleEditing={() => {
          setIsEditing(!isEditing);
          if (isEditing) {
            setIsInspectorOpen(false);
            setSelectedWidgetId(null);
          }
        }}
        onCreate={() => setCreating(true)}
      />

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {creating && (
        <DashboardCreateForm
          title={t('dashboards.action_new')}
          value={newTitle}
          placeholder={t('dashboards.placeholder_title')}
          confirmLabel={t('common.confirm')}
          onValueChange={setNewTitle}
          onConfirm={handleCreate}
          onCancel={() => { setCreating(false); setNewTitle(''); }}
        />
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-10">

          <DashboardSidebarNav
            dashboards={dashboards}
            activeDashboardId={active?.id}
            title={t('dashboards.list_header')}
            onSelect={(dashboard) => {
              setActive(dashboard);
              setActiveTabIdx(0);
              setEditingTitle(false);
              setIsEditing(false);
            }}
          />

          {/* Dashboard Area */}
          {active && (
            <div className="flex flex-col gap-8">
              <DashboardTitleBar
                title={active.title}
                draftTitle={draftTitle}
                isEditingTitle={editingTitle}
                isEditingDashboard={isEditing}
                onDraftTitleChange={setDraftTitle}
                onStartEditingTitle={() => { setDraftTitle(active.title); setEditingTitle(true); }}
                onCancelEditingTitle={() => setEditingTitle(false)}
                onConfirmTitle={handleRenameConfirm}
                onDelete={() => handleDelete(active.id)}
              />

              <DashboardTabsNav
                tabs={active.tabs}
                activeTabIdx={activeTabIdx}
                isEditing={isEditing}
                isAddingTab={addingTab}
                placeholder={t('dashboards.placeholder_tab_title')}
                onSelectTab={(index) => {
                  setActiveTabIdx(index);
                  setSelectedWidgetId(null);
                  setIsInspectorOpen(false);
                }}
                onDeleteTab={handleDeleteTab}
                onStartAddingTab={() => setAddingTab(true)}
                onAddTab={handleAddTab}
                onCancelAddingTab={() => setAddingTab(false)}
              />

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
                   
                   {isEditing && (
                     <DashboardEditorToolbar
                       title={t('dashboards.editor.widget_management')}
                       doneLabel={t('common.done')}
                       addWidgetLabel={(type) => t(`dashboards.editor.add_${type}`, { defaultValue: type })}
                       onDone={() => { setIsEditing(false); setIsInspectorOpen(false); setSelectedWidgetId(null); }}
                       onAddWidget={handleAddWidget}
                     />
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
