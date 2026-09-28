import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { DashboardCreateForm } from '../components/DashboardCreateForm';
import { getDashboardBackgroundSource } from '../lib/dashboardBackgroundPresets';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyDashboards } from '../components/EmptyDashboards';
import type { Dashboard, DashboardWidget, WidgetType, DashboardWidgetConfig } from './dashboards/types';
import { DashboardActiveWorkspace } from './dashboards/DashboardActiveWorkspace';
import { DashboardViewOverlays } from './dashboards/DashboardViewOverlays';
import { configureTab, createDefaultWidgetConfig, insertWidget, updateWidgetConfig, type TabConfigFields } from './dashboards/dashboardMutations';
import {
  createDashboard,
  deleteDashboard,
  loadDashboards,
  saveDashboard,
} from './dashboards/dashboardOperations';
import { useDashboardTransferHistory } from './dashboards/useDashboardTransferHistory';
import { generateId } from '../utils/generateId';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';

// Main dashboard view

/** The tab marked as default opens on load/reload instead of the first tab. */
function getDefaultTabIndex(dashboard: Dashboard): number {
  const idx = dashboard.tabs.findIndex(tab => tab.isDefault);
  return idx >= 0 ? idx : 0;
}

/** The URL's tab id wins over the "default tab" flag: it reflects exactly
 * where the user was (or the link they were given), not just a static pick. */
function getInitialTabIndex(dashboard: Dashboard, preferredTabId?: string | null): number {
  if (preferredTabId) {
    const idx = dashboard.tabs.findIndex(tab => tab.id === preferredTabId);
    if (idx >= 0) return idx;
  }
  return getDefaultTabIndex(dashboard);
}

interface DashboardsViewProps {
  initialDashboardId?: string | null;
  initialTabId?: string | null;
  onDashboardCatalogChange?: (dashboards: Dashboard[]) => void;
  onOpenMobileMenu?: () => void;
}

export function DashboardsView({ initialDashboardId = null, initialTabId = null, onDashboardCatalogChange, onOpenMobileMenu }: DashboardsViewProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [dashboards, setDashboards]     = useState<Dashboard[]>([]);
  const dashboardsRef = useRef(dashboards);
  const lastResolvedRouteDashboardId = useRef(initialDashboardId);
  const publishDashboards = (update: (current: Dashboard[]) => Dashboard[]) => {
    const next = update(dashboardsRef.current);
    dashboardsRef.current = next;
    setDashboards(next);
    onDashboardCatalogChange?.(next);
    return next;
  };
  const [active, setActive]             = useState<Dashboard | null>(null);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [loadedBackground, setLoadedBackground] = useState<{ source: string; opacity: number } | null>(null);
  const [loading, setLoading]           = useState(true);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const snapshotLastUpdatedAt = useDeviceSnapshotStore((state) => state.lastUpdatedAt);
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
  const {
    isTransferring, handleExport, handleImport, importReport, isHistoryOpen, setIsHistoryOpen,
    isHistoryLoading, revisions, revisionPendingRestore, setRevisionPendingRestore,
    isRestoringRevision, handleOpenHistory, handleRestoreRevision,
  } = useDashboardTransferHistory({
    active, t, language: i18n.language, setError, publishDashboards,
    setActive, setActiveTabIdx, setIsEditing, getDefaultTabIndex,
  });

  const currentUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('hp_user_ctx');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const isOwner = Boolean(active && currentUser && active.ownerId === currentUser.id);

  const visibleTabs = useMemo(() => {
    if (!active) return [];
    if (!currentUser) return active.tabs;
    if (active.ownerId === currentUser.id) return active.tabs;
    return active.tabs.filter(tab => {
      const usersList = tab.visibility?.users;
      return Boolean(usersList?.includes(currentUser.id));
    });
  }, [active, currentUser]);

  // Adjust activeTabIdx if the currently selected tab is not visible
  useEffect(() => {
    if (!active || visibleTabs.length === 0) return;
    const currentActiveTab = active.tabs[activeTabIdx];
    if (!currentActiveTab) {
      setActiveTabIdx(0);
      return;
    }
    const isStillVisible = visibleTabs.some(t => t.id === currentActiveTab.id);
    if (!isStillVisible) {
      const firstVisibleIdx = active.tabs.findIndex(t => t.id === visibleTabs[0].id);
      setActiveTabIdx(firstVisibleIdx >= 0 ? firstVisibleIdx : 0);
    }
  }, [active, visibleTabs, activeTabIdx]);

  const fetchDashboards = useCallback(async (isInitial = false) => {
    try {
      const data = await loadDashboards(t('dashboards.error_load'));
      {
        setDashboards(data);
        dashboardsRef.current = data;
        onDashboardCatalogChange?.(data);
        setError('');
        if (data.length > 0) {
          if (isInitial) {
            const initialDashboard = data.find(dashboard => dashboard.id === initialDashboardId) ?? data[0];
            setActive(initialDashboard);
            setActiveTabIdx(getInitialTabIndex(initialDashboard, initialTabId));
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
  }, [active?.id, initialDashboardId, initialTabId, onDashboardCatalogChange, t]);

  useEffect(() => {
    fetchDashboards(true);
    void refreshSnapshot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Run only once on mount.

  useEffect(() => {
    if (!initialDashboardId || initialDashboardId === lastResolvedRouteDashboardId.current) return;
    const selected = dashboards.find(dashboard => dashboard.id === initialDashboardId);
    if (!selected) return;
    lastResolvedRouteDashboardId.current = initialDashboardId;
    setActive(selected);
    setActiveTabIdx(getInitialTabIndex(selected, initialTabId));
    setEditingTitle(false);
    setSelectedWidgetId(null);
  }, [dashboards, initialDashboardId, initialTabId]);

  // Browser back/forward (or a link straight to a specific tab) changes
  // `initialTabId` without changing the dashboard: follow it.
  useEffect(() => {
    if (!active || !initialTabId) return;
    const idx = active.tabs.findIndex(tab => tab.id === initialTabId);
    if (idx >= 0 && idx !== activeTabIdx) setActiveTabIdx(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the URL's tab id changing, not every activeTabIdx change (that would fight the effect below)
  }, [initialTabId, active]);

  // Keep the URL in sync with whatever tab is actually showing (user clicked
  // a tab, a badge jumped to another tab, a tab was added/removed, etc.) so
  // reloading — or sharing the link — lands back on this exact tab.
  useEffect(() => {
    if (!active) return;
    // On an incoming dashboard navigation, `active` still refers to the old
    // dashboard for one render. Do not replace the new route with the old ID.
    if (initialDashboardId && active.id !== initialDashboardId) return;
    const tab = active.tabs[activeTabIdx];
    if (!tab) return;
    const targetPath = `/dashboards/${active.id}/${tab.id}`;
    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true });
    }
  }, [active, activeTabIdx, initialDashboardId, location.pathname, navigate]);

  const patch = async (id: string, body: Partial<Dashboard>) => {
    try {
      const updated = await saveDashboard(id, body, t('dashboards.error_save'));
      publishDashboards((current) => current.map((dashboard) => dashboard.id === updated.id ? updated : dashboard));
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
      const created = await createDashboard(newTitle.trim(), t('dashboards.error_create'));
      publishDashboards((current) => [...current, created]);
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


  const handleSaveTabConfig = async (tabIdx: number, fields: TabConfigFields) => {
    if (!active) return;
    await patch(active.id, { tabs: configureTab(active.tabs, tabIdx, fields) });
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

    const currentTab = active.tabs[activeTabIdx];

    const isDashboardTitle = type === 'dashboard_title';
    const isSection = type === 'section';

    const existingTitle = currentTab.widgets.find(widget => widget.type === 'dashboard_title');
    if (isDashboardTitle && existingTitle) {
      setSelectedWidgetId(existingTitle.id);
      return;
    }

    const defaultConfig = createDefaultWidgetConfig(type, size, {
      titleArea: t('dashboard.editor.sections.title_area'),
      newSection: t('dashboard.editor.sections.new_section'),
      titlePlaceholder: t('dashboard.editor.sections.title_placeholder'),
      subtitlePlaceholder: t('dashboard.editor.sections.subtitle_placeholder'),
    });

    const widgetId = generateId();

    const saved = await patch(active.id, { tabs: insertWidget(active.tabs, activeTabIdx, { id: widgetId, type, config: defaultConfig }) });

    if (saved && !isSection) {
      setSelectedWidgetId(widgetId);
    }
  };

  const handleLayoutChange = async (updatedWidgets: DashboardWidget[]) => {
    if (!active) return;
    const updatedTabs = active.tabs.map((tab, idx) =>
      idx !== activeTabIdx ? tab : { ...tab, widgets: updatedWidgets }
    );
    await patch(active.id, { tabs: updatedTabs });
  };

  const handleUpdateWidgetConfig = async (widgetId: string, newConfig: Partial<DashboardWidgetConfig>) => {
    if (!active) return;
    await patch(active.id, { tabs: updateWidgetConfig(active.tabs, activeTabIdx, widgetId, newConfig) });
  };

  const handleDelete = async () => {
    if (!dashboardPendingDelete) return;
    setIsDeleting(true);
    try {
      await deleteDashboard(dashboardPendingDelete.id, t('dashboards.error_delete'));
      const remaining = publishDashboards((current) => current.filter((dashboard) => dashboard.id !== dashboardPendingDelete.id));
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

  const activeTab = active?.tabs[activeTabIdx];
  const backgroundSource = activeTab?.background
    ? getDashboardBackgroundSource(activeTab.background, API_BASE_URL)
    : null;
  const backgroundOpacity = (activeTab?.backgroundOpacity ?? 100) / 100;

  useEffect(() => {
    if (!backgroundSource) {
      setLoadedBackground(null);
      return;
    }
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setLoadedBackground({ source: backgroundSource, opacity: backgroundOpacity });
    };
    image.onerror = () => {
      if (!cancelled) setLoadedBackground(null);
    };
    image.src = backgroundSource;
    return () => { cancelled = true; };
  }, [backgroundSource, backgroundOpacity]);

  if (loading) {
    return <LoadingState label={t('dashboards.loading')} className="min-h-empty-sm" size="md" />;
  }
  // Keep the previous loaded image while the next one decodes; a tab without
  // a background clears immediately instead of showing the previous tab's art.
  const displayedBackground = backgroundSource ? loadedBackground : null;
  const snapshotLoadFailed = !snapshotLoading && snapshotLastUpdatedAt === null;

  return (
    <div className="homepilot-dashboard-screen relative isolate flex min-h-screen-dvh flex-col gap-0">
      {/* Pinned to the true viewport so a selected background and its light-mode veil
          cover the complete dashboard, including short canvases. */}
      <div
        className="homepilot-dashboard-backdrop fixed inset-0 z-0 pointer-events-none"
        style={displayedBackground ? {
          backgroundImage: `url(${displayedBackground.source})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: displayedBackground.opacity,
        } : undefined}
      />

      <div className="relative isolate flex min-h-screen-dvh min-w-0 flex-1 flex-col gap-0 animate-in fade-in duration-700">
      {error && <AlertBanner variant="danger" message={error} className="m-4 sm:m-6" />}
      {snapshotLoadFailed && <AlertBanner
        variant="warning"
        message={t('dashboards.error_devices')}
        action={<Button type="button" variant="outline" size="sm" onClick={() => { void refreshSnapshot(); }}>{t('common.retry')}</Button>}
        className="m-4 sm:m-6"
      />}
      {importReport && importReport.dashboardId === active?.id && (
        <div className="m-4 space-y-2 sm:m-6">
          <AlertBanner
            variant="warning"
            title={t(importReport.report.unresolvedBindings.length > 0
              ? 'dashboards.transfer.pending_title'
              : 'dashboards.transfer.pending_background_title')}
            message={t('dashboards.transfer.pending_message', {
              bindings: importReport.report.unresolvedBindings.length,
              backgrounds: importReport.report.nonPortableBackgrounds,
            })}
          />
          {importReport.report.unresolvedBindings.length > 0 && (
            <details className="rounded-panel border border-border/60 bg-card/90 px-4 py-3 text-body text-foreground">
              <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t('dashboards.transfer.pending_details')}</summary>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto pl-5 text-caption text-muted-foreground">
                {importReport.report.unresolvedBindings.map((item, index) => (
                  <li key={`${item.widgetId}-${item.cardId ?? ''}-${index}`} className="list-disc break-words">
                    <span className="text-foreground">{t('dashboards.transfer.pending_item', { title: item.title })}</span>
                    <span className="ml-2 text-muted-foreground">{item.tabTitle}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Dashboard creation form */}
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

      {/* Main dashboard content */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid grid-cols-1 relative z-10">
          {active && (
            <DashboardActiveWorkspace
              active={active}
              activeTab={activeTab}
              visibleTabs={visibleTabs}
              isOwner={isOwner}
              isEditing={isEditing}
              editingTitle={editingTitle}
              draftTitle={draftTitle}
              isAddingTab={addingTab}
              selectedWidgetId={selectedWidgetId}
              isTransferring={isTransferring}
              t={t}
              onOpenMobileMenu={onOpenMobileMenu}
              onDraftTitleChange={setDraftTitle}
              onStartEditingTitle={() => { setDraftTitle(active.title); setEditingTitle(true); }}
              onCancelEditingTitle={() => setEditingTitle(false)}
              onConfirmTitle={() => { void handleRenameConfirm(); }}
              onDeleteDashboard={() => setDashboardPendingDelete(active)}
              onToggleEditing={() => {
                setIsEditing(!isEditing);
                if (isEditing) {
                  setSelectedWidgetId(null);
                  setTabConfigIdx(null);
                }
              }}
              onCreateDashboard={() => setCreating(true)}
              onExport={() => { void handleExport(); }}
              onImport={(file) => { void handleImport(file); }}
              onOpenHistory={() => { void handleOpenHistory(); }}
              onSelectTab={(index) => {
                const targetTab = visibleTabs[index];
                if (targetTab) {
                  const originalIdx = active.tabs.findIndex(tab => tab.id === targetTab.id);
                  setActiveTabIdx(originalIdx >= 0 ? originalIdx : 0);
                }
                setSelectedWidgetId(null);
              }}
              onConfigureTab={(index) => {
                const targetTab = visibleTabs[index];
                if (targetTab) {
                  const originalIdx = active.tabs.findIndex(tab => tab.id === targetTab.id);
                  setTabConfigIdx(originalIdx >= 0 ? originalIdx : 0);
                }
              }}
              onStartAddingTab={() => setAddingTab(true)}
              onAddTab={(title) => { void handleAddTab(title); }}
              onCancelAddingTab={() => setAddingTab(false)}
              onAddWidget={(type, size) => { void handleAddWidget(type, size); }}
              onSelectWidget={setSelectedWidgetId}
              onLayoutChange={(widgets) => { void handleLayoutChange(widgets); }}
              onWidgetConfigChange={(widgetId, config) => { void handleUpdateWidgetConfig(widgetId, config); }}
              onSelectCanvasTab={(tabId) => {
                const targetIdx = active.tabs.findIndex(tab => tab.id === tabId);
                if (targetIdx < 0) return;
                setActiveTabIdx(targetIdx);
                setSelectedWidgetId(null);
              }}
            />
          )}
        </div>
      )}

      <DashboardViewOverlays
        active={active}
        tabConfigIdx={tabConfigIdx}
        setTabConfigIdx={setTabConfigIdx}
        tabPendingDelete={tabPendingDelete}
        setTabPendingDelete={setTabPendingDelete}
        dashboardPendingDelete={dashboardPendingDelete}
        setDashboardPendingDelete={setDashboardPendingDelete}
        isDeleting={isDeleting}
        isHistoryOpen={isHistoryOpen}
        setIsHistoryOpen={setIsHistoryOpen}
        isHistoryLoading={isHistoryLoading}
        revisions={revisions}
        revisionPendingRestore={revisionPendingRestore}
        setRevisionPendingRestore={setRevisionPendingRestore}
        isRestoringRevision={isRestoringRevision}
        handleSaveTabConfig={handleSaveTabConfig}
        handleDeleteTab={handleDeleteTab}
        handleDelete={handleDelete}
        handleRestoreRevision={handleRestoreRevision}
      />
      </div>
    </div>
  );
}
