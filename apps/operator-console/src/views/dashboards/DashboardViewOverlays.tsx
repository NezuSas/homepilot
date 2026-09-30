import type { ComponentProps, Dispatch, SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardHistoryModal, type DashboardRevisionSummary } from '../../components/DashboardHistoryModal';
import { DashboardViewConfigModal } from '../../components/DashboardViewConfigModal';
import ConfirmModal from '../../components/ConfirmModal';
import type { Dashboard } from './types';

type TabConfigFields = Parameters<ComponentProps<typeof DashboardViewConfigModal>['onSave']>[0];

interface DashboardViewOverlaysProps {
  active: Dashboard | null;
  tabConfigIdx: number | null;
  setTabConfigIdx: Dispatch<SetStateAction<number | null>>;
  tabPendingDelete: number | null;
  setTabPendingDelete: Dispatch<SetStateAction<number | null>>;
  isDeleting: boolean;
  isHistoryOpen: boolean;
  setIsHistoryOpen: Dispatch<SetStateAction<boolean>>;
  isHistoryLoading: boolean;
  revisions: DashboardRevisionSummary[];
  revisionPendingRestore: DashboardRevisionSummary | null;
  setRevisionPendingRestore: Dispatch<SetStateAction<DashboardRevisionSummary | null>>;
  isRestoringRevision: boolean;
  handleSaveTabConfig: (tabIdx: number, fields: TabConfigFields) => void | Promise<void>;
  handleDeleteTab: (tabIdx: number) => void | Promise<void>;
  handleRestoreRevision: () => void | Promise<void>;
}

export function DashboardViewOverlays({
  active, tabConfigIdx, setTabConfigIdx, tabPendingDelete, setTabPendingDelete,
  isDeleting, isHistoryOpen,
  setIsHistoryOpen, isHistoryLoading, revisions, revisionPendingRestore,
  setRevisionPendingRestore, isRestoringRevision, handleSaveTabConfig, handleDeleteTab,
  handleRestoreRevision,
}: DashboardViewOverlaysProps) {
  const { t } = useTranslation();
  return (
    <>
      <DashboardViewConfigModal
        isOpen={tabConfigIdx !== null && Boolean(active?.tabs[tabConfigIdx ?? 0])}
        tab={active?.tabs[tabConfigIdx ?? 0] ?? { title: '' }}
        defaultTabOwnerTitle={active?.tabs.find((tab, index) => index !== tabConfigIdx && tab.isDefault)?.title}
        onClose={() => setTabConfigIdx(null)}
        onSave={(fields) => {
          if (tabConfigIdx === null) return;
          void handleSaveTabConfig(tabConfigIdx, fields);
          setTabConfigIdx(null);
        }}
        onDelete={() => {
          if (tabConfigIdx === null) return;
          setTabPendingDelete(tabConfigIdx);
          setTabConfigIdx(null);
        }}
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

      <DashboardHistoryModal
        isOpen={isHistoryOpen}
        revisions={revisions}
        isLoading={isHistoryLoading}
        onClose={() => { if (!isHistoryLoading) setIsHistoryOpen(false); }}
        onRestore={setRevisionPendingRestore}
      />

      <ConfirmModal
        isOpen={revisionPendingRestore !== null}
        onClose={() => { if (!isRestoringRevision) setRevisionPendingRestore(null); }}
        onConfirm={() => { void handleRestoreRevision(); }}
        title={t('dashboards.history.restore_title')}
        description={t('dashboards.history.restore_description', { title: revisionPendingRestore?.snapshot.title ?? '' })}
        confirmText={t('dashboards.history.restore')}
        cancelText={t('common.cancel')}
        variant="warning"
        isSubmitting={isRestoringRevision}
      />
    </>
  );
}
