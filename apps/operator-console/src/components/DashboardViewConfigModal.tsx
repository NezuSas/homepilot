import React, { useMemo } from 'react';
import { Eye, Image, SlidersHorizontal, Trash2, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { SegmentedControl } from './ui/SegmentedControl';
import { Modal } from './ui/Modal';
import { DashboardViewSettingsTab } from './dashboardViewConfig/DashboardViewSettingsTab';
import { DashboardViewBackgroundTab } from './dashboardViewConfig/DashboardViewBackgroundTab';
import { DashboardViewVisibilityTab } from './dashboardViewConfig/DashboardViewVisibilityTab';
import { useViewConfigDraft } from './dashboardViewConfig/useViewConfigDraft';
import { useViewConfigUsers } from './dashboardViewConfig/useViewConfigUsers';
import { useAmberResidenceAvailable } from './dashboardViewConfig/useAmberResidenceAvailable';
import {
  buildRouteSlug,
  type DashboardViewConfigSaveFields,
  type DashboardViewConfigTabData,
  type ViewConfigTab,
} from './dashboardViewConfig/viewConfigModel';

interface DashboardViewConfigModalProps {
  isOpen: boolean;
  defaultTabOwnerTitle?: string;
  tab: DashboardViewConfigTabData;
  onClose: () => void;
  onSave: (fields: DashboardViewConfigSaveFields) => void;
  onDelete: () => void;
}

export const DashboardViewConfigModal: React.FC<DashboardViewConfigModalProps> = ({
  isOpen,
  defaultTabOwnerTitle,
  tab,
  onClose,
  onSave,
  onDelete,
}) => {
  const { t } = useTranslation();
  const draft = useViewConfigDraft(isOpen, tab);
  const { users, loadingUsers } = useViewConfigUsers(isOpen, tab);
  const amberResidenceAvailable = useAmberResidenceAvailable(isOpen);

  const { draftTitle, setAllowedUsers } = draft;
  const routeSlug = useMemo(() => buildRouteSlug(draftTitle, tab.title), [draftTitle, tab.title]);

  if (!isOpen) return null;

  const tabs: Array<{ id: ViewConfigTab; label: string; icon: LucideIcon }> = [
    { id: 'settings', label: t('dashboards.view_config.settings'), icon: SlidersHorizontal },
    { id: 'background', label: t('dashboards.view_config.background'), icon: Image },
    { id: 'visibility', label: t('dashboards.view_config.visibility'), icon: Eye },
  ];

  const handleSave = () => {
    const trimmedTitle = draft.draftTitle.trim();
    if (trimmedTitle.length === 0) return;

    onSave({
      maxColumns: draft.maxColumns,
      title: trimmedTitle,
      icon: draft.iconQuery.trim() || undefined,
      background: draft.backgroundImg,
      backgroundOpacity: draft.backgroundOpacity,
      visibility: { users: draft.allowedUsers },
      isDefault: draft.isDefaultTab,
    });
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setAllowedUsers(prev => [...prev, userId]);
    } else {
      setAllowedUsers(prev => prev.filter(id => id !== userId));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboards.view_config.title', { title: tab.title })}
      headerAlign="start"
      closeLabel={t('common.close')}
      layerClassName="z-[120]"
      className="max-w-2xl border-border/70"
      headerClassName="border-b border-border/60 px-5 py-4 sm:px-6 sm:py-5"
      contentClassName="p-0"
      footer={(
        <>
          <Button type="button" variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            {t('dashboards.view_config.delete_view')}
          </Button>
          <Button type="button" onClick={handleSave}>
            {t('common.save')}
          </Button>
        </>
      )}
      footerClassName="justify-between px-5 py-4 sm:px-6"
    >
        <nav className="shrink-0 border-b border-border/60 px-3 py-3 sm:px-5">
          <SegmentedControl
            value={draft.activeTab}
            options={tabs.map(({ id, label, icon }) => ({ value: id, label, icon }))}
            onChange={draft.setActiveTab}
            label={t('dashboards.view_config.title', { title: tab.title })}
            layout="wrap"
            className="w-full"
          />
        </nav>

        <div className="min-w-0 p-3 sm:p-6">
          {draft.activeTab === 'settings' && (
            <DashboardViewSettingsTab
              maxColumns={draft.maxColumns}
              draftTitle={draft.draftTitle}
              iconQuery={draft.iconQuery}
              routeSlug={routeSlug}
              isDefaultTab={draft.isDefaultTab}
              defaultTabOwnerTitle={defaultTabOwnerTitle}
              isCurrentDefault={tab.isDefault}
              onMaxColumnsChange={draft.setMaxColumns}
              onTitleChange={draft.setDraftTitle}
              onIconChange={draft.setIconQuery}
              onDefaultChange={draft.setIsDefaultTab}
            />
          )}

          {draft.activeTab === 'background' && (
            <DashboardViewBackgroundTab
              backgroundImg={draft.backgroundImg}
              backgroundOpacity={draft.backgroundOpacity}
              amberResidenceAvailable={amberResidenceAvailable}
              onBackgroundChange={draft.setBackgroundImg}
              onOpacityChange={draft.setBackgroundOpacity}
            />
          )}

          {draft.activeTab === 'visibility' && (
            <DashboardViewVisibilityTab
              users={users}
              loadingUsers={loadingUsers}
              allowedUsers={draft.allowedUsers}
              onUserToggle={handleUserToggle}
            />
          )}
        </div>
    </Modal>
  );
};
