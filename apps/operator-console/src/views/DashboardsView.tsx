import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { DashboardCreateForm } from '../components/DashboardCreateForm';
import { DashboardEditorToolbar } from '../components/DashboardEditorToolbar';
import { DashboardTabsNav } from '../components/DashboardTabsNav';
import { DashboardTitleBar } from '../components/DashboardTitleBar';
import { DashboardViewConfigModal } from '../components/DashboardViewConfigModal';
import { DashboardsLoadingState } from '../components/DashboardsLoadingState';
import { EmptyDashboards } from '../components/EmptyDashboards';
import type { Dashboard, DashboardWidget, WidgetType, DashboardWidgetConfig } from './dashboards/types';
import { DashboardCanvas } from './dashboards/DashboardCanvas';
import { WidgetInspector } from './dashboards/WidgetInspector';
import { generateId } from '../utils/generateId';
import { AlertBanner } from '../components/ui/AlertBanner';
import ConfirmModal from '../components/ConfirmModal';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const API = `${API_BASE_URL}/api/v1`;

// ─── Main View ────────────────────────────────────────────────────────────────

interface DashboardsViewProps {
  initialDashboardId?: string | null;
  onDashboardCatalogChange?: (dashboards: Dashboard[]) => void;
}

export function DashboardsView({ initialDashboardId = null, onDashboardCatalogChange }: DashboardsViewProps) {
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
  const [error, setError]               = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [dashboardPendingDelete, setDashboardPendingDelete] = useState<Dashboard | null>(null);
  const [tabPendingDelete, setTabPendingDelete] = useState<number | null>(null);
  const [tabConfigIdx, setTabConfigIdx] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  const fetchDashboards = useCallback(async (isInitial = false) => {
    try {
      const res = await apiFetch(`${API}/dashboards`);
      if (!res.ok) throw new Error(await readApiError(res, t('dashboards.error_load')));
      const data = await res.json();
      if (Array.isArray(data)) {
        setDashboards(data);
        onDashboardCatalogChange?.(data);
        setError('');
        if (data.length > 0) {
          if (isInitial) {
            setActive(data.find(dashboard => dashboard.id === initialDashboardId) ?? data[0]);
            setActiveTabIdx(0);
          } else {
            const current = data.find(d => d.id === active?.id);
            if (current) setActive(current);
          }
        }
      }
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.error_load'));
    }
    finally { setLoading(false); }
  }, [active?.id, initialDashboardId, onDashboardCatalogChange, t]);

  useEffect(() => { 
    fetchDashboards(true);
  }, []); // Run ONLY once on mount.

  useEffect(() => {
    if (!initialDashboardId || active?.id === initialDashboardId) return;
    const selected = dashboards.find(dashboard => dashboard.id === initialDashboardId);
    if (!selected) return;
    setActive(selected);
    setActiveTabIdx(0);
    setEditingTitle(false);
    setSelectedWidgetId(null);
    setIsInspectorOpen(false);
  }, [active?.id, dashboards, initialDashboardId]);

  const patch = async (id: string, body: Partial<Dashboard>) => {
    try {
      const res = await apiFetch(`${API}/dashboards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await readApiError(res, t('dashboards.error_save')));
      const updated: Dashboard = await res.json();
      setDashboards(prev => prev.map(d => d.id === updated.id ? updated : d));
      setActive(updated);
      setError('');
      return true;
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.error_save'));
      return false;
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSubmittingCreate(true);
    setError('');
    try {
      const res = await apiFetch(`${API}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() })
      });
      if (!res.ok) throw new Error(await readApiError(res, t('dashboards.error_create')));
      const created: Dashboard = await res.json();
      setDashboards(prev => {
        const next = [...prev, created];
        onDashboardCatalogChange?.(next);
        return next;
      });
      setActive(created);
      setActiveTabIdx(0);
      setNewTitle('');
      setCreating(false);
      setIsEditing(true);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.error_create'));
    } finally {
      setSubmittingCreate(false);
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
    const saved = await patch(active.id, { tabs: [...active.tabs, { id: newTabId, title: title.trim(), widgets: [] }] });
    if (saved) {
      setActiveTabIdx(active.tabs.length);
      setIsEditing(true);
    }
  };

  const handleRenameTab = async (tabIdx: number, title: string) => {
    if (!active || !title.trim()) return;
    const updatedTabs = active.tabs.map((tab, idx) => (
      idx === tabIdx ? { ...tab, title: title.trim() } : tab
    ));
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleDeleteTab = async (tabIdx: number) => {
    if (!active) return;
    const updatedTabs = active.tabs.filter((_, idx) => idx !== tabIdx);
    setIsDeleting(true);
    const saved = await patch(active.id, { tabs: updatedTabs });
    if (saved) setActiveTabIdx(Math.max(0, activeTabIdx - 1));
    setTabPendingDelete(null);
    setIsDeleting(false);
  };

  const handleAddWidget = async (type: WidgetType, size?: { w: number; h: number }) => {
    if (!active || active.tabs.length === 0) return;
    
    // Find a free spot (naive start at bottom)
    const currentTab = active.tabs[activeTabIdx];
    const maxY = currentTab.widgets.reduce((max, w) => Math.max(max, w.config.layout.y + w.config.layout.h), 0);

    const widgetW = type === 'section' ? 12 : (size?.w ?? 4);
    const widgetH = type === 'section' ? 2  : (size?.h ?? 4);

    const defaultConfig: DashboardWidgetConfig = {
      layout: { x: 0, y: maxY, w: widgetW, h: widgetH },
      binding: { entityId: '', entityType: 'device' },
      visibility: { rules: [], defaultState: 'show' },
      appearance: { variant: 'glass', title: '', showTitle: true }
    };
    const widgetId = generateId();
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: [...tab.widgets, { id: widgetId, type, config: defaultConfig }] }
    );
    const saved = await patch(active.id, { tabs: updatedTabs });
    if (saved) {
      setSelectedWidgetId(widgetId);
      setIsInspectorOpen(true);
    }
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
              layout: { ...w.config.layout, ...(newConfig.layout || {}) },
              extra: { ...w.config.extra, ...(newConfig.extra || {}) }
            }
          };
        })
      };
    });
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleDelete = async () => {
    if (!dashboardPendingDelete) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`${API}/dashboards/${dashboardPendingDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, t('dashboards.error_delete')));
      const remaining = dashboards.filter(d => d.id !== dashboardPendingDelete.id);
      setDashboards(remaining);
      setActive(remaining.length > 0 ? remaining[0] : null);
      setActiveTabIdx(0);
      setDashboardPendingDelete(null);
      setError('');
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.error_delete'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return <DashboardsLoadingState label={t('dashboards.loading')} />;
  }

  const activeTab = active?.tabs[activeTabIdx];

  return (
    <div className="relative flex min-h-full flex-col gap-0 animate-in fade-in duration-700">

      {error && <AlertBanner variant="danger" message={error} className="m-4 sm:m-6" />}

      {/* ── Create Form ──────────────────────────────────────────────── */}
      {creating && (
        <DashboardCreateForm
          title={t('dashboards.action_new')}
          value={newTitle}
          placeholder={t('dashboards.placeholder_title')}
          confirmLabel={t('common.confirm')}
          isSubmitting={submittingCreate}
          onValueChange={setNewTitle}
          onConfirm={handleCreate}
          onCancel={() => { setCreating(false); setNewTitle(''); }}
        />
      )}

      {/* ── Main Content ─────────────────────────────────────────────── */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1">
          {/* Dashboard Area */}
          {active && (
            <div className="flex min-w-0 flex-col">
              {isEditing && (
                <DashboardTitleBar
                  title={active.title}
                  draftTitle={draftTitle}
                  isEditingTitle={editingTitle}
                  isEditingDashboard={isEditing}
                  onDraftTitleChange={setDraftTitle}
                  onStartEditingTitle={() => { setDraftTitle(active.title); setEditingTitle(true); }}
                  onCancelEditingTitle={() => setEditingTitle(false)}
                  onConfirmTitle={handleRenameConfirm}
                  onDelete={() => setDashboardPendingDelete(active)}
                  deleteLabel={t('dashboards.delete')}
                  editLabel={t('dashboards.action_edit')}
                  doneLabel={t('common.done')}
                  newLabel={t('dashboards.action_new')}
                  helpLabel={t('common.help')}
                  moreLabel={t('common.more')}
                  onToggleEditing={() => {
                    setIsEditing(!isEditing);
                    if (isEditing) {
                      setIsInspectorOpen(false);
                      setSelectedWidgetId(null);
                      setTabConfigIdx(null);
                    }
                  }}
                  onCreate={() => setCreating(true)}
                />
              )}

              <DashboardTabsNav
                tabs={active.tabs}
                activeTabIdx={activeTabIdx}
                isEditing={isEditing}
                isAddingTab={addingTab}
                placeholder={t('dashboards.placeholder_tab_title')}
                addLabel={t('dashboards.action_add_tab')}
                configureLabel={t('dashboards.view_config.configure_view')}
                onSelectTab={(index) => {
                  setActiveTabIdx(index);
                  setSelectedWidgetId(null);
                  setIsInspectorOpen(false);
                }}
                onConfigureTab={setTabConfigIdx}
                onStartAddingTab={() => setAddingTab(true)}
                onAddTab={handleAddTab}
                onCancelAddingTab={() => setAddingTab(false)}
                onToggleEditing={() => setIsEditing(!isEditing)}
                editLabel={t('dashboards.action_edit')}
              />

              {/* Canvas Area */}
              {activeTab ? (
                <div className={cn("relative flex flex-col gap-4 w-full", isEditing ? "p-3 sm:p-4" : "p-0 py-3 sm:py-4")}>
                   {isEditing && (
                     <DashboardEditorToolbar
                       isOpen={isCatalogModalOpen}
                       onClose={() => setIsCatalogModalOpen(false)}
                       onAddWidget={(type, size) => {
                          void handleAddWidget(type, size);
                          setIsCatalogModalOpen(false);
                       }}
                     />
                   )}

                   {activeTab.widgets.length === 0 && !isEditing ? (
                     <div className="flex min-h-64 flex-col items-center justify-center rounded-panel border border-dashed border-primary/25 bg-primary/[0.03] p-8 text-center">
                       <p className="text-section-title font-semibold text-foreground">{t('dashboards.widgets_empty')}</p>
                       <p className="mt-2 max-w-lg text-caption text-muted-foreground">{t('dashboards.widgets_empty_hint')}</p>
                       <Button className="mt-5" onClick={() => setIsEditing(true)}>{t('dashboards.add_first_widget')}</Button>
                     </div>
                   ) : (
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
                      onAddCardClick={() => {
                         // We could use x, y for placement, but for now we just open catalog
                         setIsCatalogModalOpen(true);
                      }}
                      onAddSectionClick={() => {
                         void handleAddWidget('section');
                      }}
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

      <DashboardViewConfigModal
        isOpen={tabConfigIdx !== null && Boolean(active?.tabs[tabConfigIdx ?? 0])}
        title={active?.tabs[tabConfigIdx ?? 0]?.title ?? ''}
        onClose={() => setTabConfigIdx(null)}
        onSave={(title) => {
          if (tabConfigIdx === null) return;
          void handleRenameTab(tabConfigIdx, title);
          setTabConfigIdx(null);
        }}
        onDelete={() => {
          if (tabConfigIdx === null) return;
          setTabPendingDelete(tabConfigIdx);
          setTabConfigIdx(null);
        }}
      />

      <ConfirmModal
        isOpen={dashboardPendingDelete !== null}
        onClose={() => { if (!isDeleting) setDashboardPendingDelete(null); }}
        onConfirm={handleDelete}
        title={t('dashboards.delete_dashboard_title')}
        description={t('dashboards.delete_dashboard_description', { title: dashboardPendingDelete?.title || '' })}
        confirmText={t('dashboards.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isSubmitting={isDeleting}
      />

      <ConfirmModal
        isOpen={tabPendingDelete !== null}
        onClose={() => { if (!isDeleting) setTabPendingDelete(null); }}
        onConfirm={() => { if (tabPendingDelete !== null) void handleDeleteTab(tabPendingDelete); }}
        title={t('dashboards.delete_tab_title')}
        description={t('dashboards.delete_tab_confirm')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isSubmitting={isDeleting}
      />
    </div>
  );
}
