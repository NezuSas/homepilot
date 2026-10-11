import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardsSkeleton } from '../components/ui/ComponentSkeletons';
import { EmptyDashboards } from '../components/EmptyDashboards';
import type { Dashboard } from './dashboards/types';
import { DashboardActiveWorkspace } from './dashboards/DashboardActiveWorkspace';
import { DashboardViewOverlays } from './dashboards/DashboardViewOverlays';
import { DashboardImportReportBanner } from './dashboards/DashboardImportReportBanner';
import { getDefaultTabIndex, toDashboardTabIndex } from './dashboards/dashboardTabSelection';
import { useDashboardTransferHistory } from './dashboards/useDashboardTransferHistory';
import { useDashboardCatalog } from './dashboards/useDashboardCatalog';
import { useDashboardAccess } from './dashboards/useDashboardAccess';
import { useDashboardRouteSync } from './dashboards/useDashboardRouteSync';
import { useDashboardPatch } from './dashboards/useDashboardPatch';
import { useDashboardActions } from './dashboards/useDashboardActions';
import { useDashboardBackground } from './dashboards/useDashboardBackground';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';

// Main dashboard view

interface DashboardsViewProps {
  initialDashboardId?: string | null;
  initialTabId?: string | null;
  onDashboardCatalogChange?: (dashboards: Dashboard[]) => void;
  onOpenMobileMenu?: () => void;
}

export function DashboardsView({ initialDashboardId = null, initialTabId = null, onDashboardCatalogChange, onOpenMobileMenu }: DashboardsViewProps) {
  const { t, i18n } = useTranslation();
  const {
    dashboards, active, setActive, activeTabIdx, setActiveTabIdx,
    loading, error, setError, publishDashboards, fetchDashboards,
  } = useDashboardCatalog({ initialDashboardId, initialTabId, onDashboardCatalogChange });
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const snapshotLoading = useDeviceSnapshotStore((state) => state.isLoading);
  const snapshotLastUpdatedAt = useDeviceSnapshotStore((state) => state.lastUpdatedAt);
  const [draftTitle, setDraftTitle]     = useState('');
  const [addingTab, setAddingTab]       = useState(false);
  const [tabPendingDelete, setTabPendingDelete] = useState<number | null>(null);
  const [tabConfigIdx, setTabConfigIdx] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  useEffect(() => { if (active && !isEditing) setDraftTitle(active.title); }, [active, isEditing]);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const {
    isTransferring, handleExport, handleImport, importReport, isHistoryOpen, setIsHistoryOpen,
    isHistoryLoading, revisions, revisionPendingRestore, setRevisionPendingRestore,
    isRestoringRevision, handleOpenHistory, handleRestoreRevision,
  } = useDashboardTransferHistory({
    active, activeTabId: active?.tabs[activeTabIdx]?.id, t, language: i18n.language, setError, publishDashboards,
    setActive, setActiveTabIdx, setIsEditing, getDefaultTabIndex,
  });

  const { isOwner, visibleTabs } = useDashboardAccess(active, activeTabIdx, setActiveTabIdx);
  useDashboardRouteSync({
    dashboards, active, activeTabIdx, initialDashboardId, initialTabId, setActive, setActiveTabIdx, setSelectedWidgetId,
  });
  const { patch, editSession, editStatus } = useDashboardPatch({
    active, isEditing, isOwner, isBusy: isTransferring || isRestoringRevision, t, setActive, setError, publishDashboards,
  });
  const {
    isDeleting, handleRenameConfirm, handleAddTab, handleSaveTabConfig, handleDeleteTab,
    handleAddWidget, handleLayoutChange, handleUpdateWidgetConfig,
  } = useDashboardActions({
    active, activeTabIdx, draftTitle, t, patch, setActiveTabIdx, setAddingTab, setIsEditing, setSelectedWidgetId, setTabPendingDelete,
  });

  const activeTab = active?.tabs[activeTabIdx];
  const displayedBackground = useDashboardBackground(activeTab);

  if (loading) {
    return <DashboardsSkeleton label={t('dashboards.loading')} />;
  }
  const snapshotLoadFailed = !snapshotLoading && snapshotLastUpdatedAt === null;

  return (
    <div className="homepilot-dashboard-screen relative isolate flex min-h-screen-dvh flex-col gap-0">
      {/* Pinned to the true viewport so a selected background and its light-mode veil
          cover the complete dashboard, including short canvases. */}
      <div
        className="homepilot-dashboard-backdrop fixed inset-0 z-0 pointer-events-none"
      >
        <div className="absolute inset-0" style={displayedBackground ? {
          backgroundImage: `url(${displayedBackground.source})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: displayedBackground.opacity,
        } : undefined} />
      </div>

      <div className="relative isolate flex min-h-screen-dvh min-w-0 flex-1 flex-col gap-0 animate-in fade-in duration-700">
      {error && <AlertBanner variant="danger" message={error} className="m-4 sm:m-6" />}
      {snapshotLoadFailed && <AlertBanner
        variant="warning"
        message={t('dashboards.error_devices')}
        action={<Button type="button" variant="outline" size="sm" onClick={() => { void refreshSnapshot(); }}>{t('common.retry')}</Button>}
        className="m-4 sm:m-6"
      />}
      {importReport && importReport.dashboardId === active?.id && (
        <DashboardImportReportBanner report={importReport.report} t={t} />
      )}

      {/* Main dashboard content */}
      {dashboards.length === 0 ? (
        <EmptyDashboards onRetry={() => { void fetchDashboards(true); }} />
      ) : (
        <div className="grid grid-cols-1 relative z-10">
          {active && (
            <DashboardActiveWorkspace
              active={active}
              activeTab={activeTab}
              visibleTabs={visibleTabs}
              isOwner={isOwner}
              isEditing={isEditing}
              draftTitle={draftTitle}
              isAddingTab={addingTab}
              selectedWidgetId={selectedWidgetId}
              isTransferring={isTransferring || editStatus.pending}
              editStatus={editStatus}
              onUndo={() => { void editSession.current?.undo(); }}
              onRedo={() => { void editSession.current?.redo(); }}
              t={t}
              onOpenMobileMenu={onOpenMobileMenu}
              onDraftTitleChange={setDraftTitle}
              onConfirmTitle={() => { void handleRenameConfirm(); }}
              onToggleEditing={() => {
                if (!isEditing) {
                  setDraftTitle(active.title);
                  setIsEditing(true);
                  return;
                }
                void (async () => {
                  if (!draftTitle.trim()) return;
                  if (draftTitle.trim() !== active.title && !await patch(active.id, { title: draftTitle.trim() })) return;
                  await editSession.current?.whenIdle();
                  setIsEditing(false);
                  setSelectedWidgetId(null);
                  setTabConfigIdx(null);
                })();
              }}
              onExport={() => { void handleExport(); }}
              onImport={(file) => { void handleImport(file); }}
              onOpenHistory={() => { void handleOpenHistory(); }}
              onSelectTab={(index) => {
                const target = toDashboardTabIndex(active, visibleTabs, index);
                if (target !== null) setActiveTabIdx(target);
                setSelectedWidgetId(null);
              }}
              onConfigureTab={(index) => {
                const target = toDashboardTabIndex(active, visibleTabs, index);
                if (target !== null) setTabConfigIdx(target);
              }}
              onStartAddingTab={() => setAddingTab(true)}
              onAddTab={(title) => { void handleAddTab(title); }}
              onCancelAddingTab={() => setAddingTab(false)}
              onAddWidget={(type, size) => { void handleAddWidget(type, size); }}
              onSelectWidget={setSelectedWidgetId}
              onLayoutChange={(widgets, layout) => { void handleLayoutChange(widgets, layout); }}
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
        handleRestoreRevision={handleRestoreRevision}
      />
      </div>
    </div>
  );
}
