import { useState, type Dispatch, type SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { DashboardRevisionSummary } from '../../components/DashboardHistoryModal';
import type { Dashboard, DashboardImportReport } from './types';
import { exportDashboard, importDashboard, loadDashboardHistory, restoreDashboardRevision } from './dashboardOperations';

interface DashboardTransferHistoryOptions {
  active: Dashboard | null;
  t: TFunction;
  language: string;
  setError: Dispatch<SetStateAction<string>>;
  publishDashboards: (update: (current: Dashboard[]) => Dashboard[]) => Dashboard[];
  setActive: Dispatch<SetStateAction<Dashboard | null>>;
  setActiveTabIdx: Dispatch<SetStateAction<number>>;
  setIsEditing: Dispatch<SetStateAction<boolean>>;
  getDefaultTabIndex: (dashboard: Dashboard) => number;
}

export function useDashboardTransferHistory({
  active, t, language, setError, publishDashboards, setActive,
  setActiveTabIdx, setIsEditing, getDefaultTabIndex,
}: DashboardTransferHistoryOptions) {
  const [isTransferring, setIsTransferring] = useState(false);
  const [importReport, setImportReport] = useState<{ dashboardId: string; report: DashboardImportReport } | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [revisions, setRevisions] = useState<DashboardRevisionSummary[]>([]);
  const [revisionPendingRestore, setRevisionPendingRestore] = useState<DashboardRevisionSummary | null>(null);
  const [isRestoringRevision, setIsRestoringRevision] = useState(false);

  const handleExport = async () => {
    if (!active || isTransferring) return;
    setIsTransferring(true);
    setError('');
    try {
      const transfer = await exportDashboard(active.id, t('dashboards.transfer.error_export'));
      const file = new Blob([JSON.stringify(transfer, null, 2)], { type: 'application/json' });
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement('a');
      const fileTitle = active.title.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'dashboard';
      link.href = objectUrl;
      link.download = `${fileTitle}.homepilot-dashboard.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.transfer.error_export'));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleImport = async (file: File) => {
    if (isTransferring) return;
    setIsTransferring(true);
    setError('');
    setImportReport(null);
    try {
      let transfer: unknown;
      try {
        transfer = JSON.parse(await file.text());
      } catch {
        throw new Error(t('dashboards.transfer.error_import'));
      }
      const imported = await importDashboard(transfer, t('dashboards.transfer.error_import'), language);
      const { importReport: report, ...dashboard } = imported;
      publishDashboards((current) => {
        const existing = current.find((candidate) => candidate.id === dashboard.id);
        return existing
          ? current.map((candidate) => candidate.id === dashboard.id ? dashboard : candidate)
          : [...current, dashboard];
      });
      setActive(dashboard);
      setActiveTabIdx(getDefaultTabIndex(dashboard));
      setIsEditing(true);
      if (report && (report.unresolvedBindings.length > 0 || report.nonPortableBackgrounds > 0)) {
        setImportReport({ dashboardId: dashboard.id, report });
      }
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.transfer.error_import'));
    } finally {
      setIsTransferring(false);
    }
  };

  const handleOpenHistory = async () => {
    if (!active) return;
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    setError('');
    try {
      const history = await loadDashboardHistory(active.id, t('dashboards.history.error_load'));
      setRevisions(history);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.history.error_load'));
      setIsHistoryOpen(false);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleRestoreRevision = async () => {
    if (!active || !revisionPendingRestore) return;
    setIsRestoringRevision(true);
    setError('');
    try {
      const restored = await restoreDashboardRevision(active.id, revisionPendingRestore.id, t('dashboards.history.error_restore'));
      publishDashboards((current) => current.map((dashboard) => dashboard.id === restored.id ? restored : dashboard));
      setActive(restored);
      setActiveTabIdx(getDefaultTabIndex(restored));
      setRevisionPendingRestore(null);
      setIsHistoryOpen(false);
      setIsEditing(false);
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('dashboards.history.error_restore'));
    } finally {
      setIsRestoringRevision(false);
    }
  };

  return {
    isTransferring, handleExport, handleImport, importReport, isHistoryOpen, setIsHistoryOpen,
    isHistoryLoading, revisions, revisionPendingRestore, setRevisionPendingRestore,
    isRestoringRevision, handleOpenHistory, handleRestoreRevision,
  };
}
