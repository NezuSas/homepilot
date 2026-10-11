import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DeviceInspectorSkeleton } from './ui/ComponentSkeletons';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import { DeviceInspectorInfoTab, DeviceInspectorLogsTab, DeviceInspectorStateTab } from './DeviceInspectorTabs';
import { DeviceInspectorHeader, type DeviceInspectorTab } from './DeviceInspectorHeader';
import { isDeviceOnline } from './deviceInspectorModel';
import { useDeviceInspector } from './useDeviceInspector';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from './ConfirmModal';
import { Button } from './ui/Button';
import { Drawer } from './ui/Drawer';

interface DeviceInspectorProps {
  configurationOnly?: boolean;
  deviceId: string;
  rooms: Room[];
  onClose: () => void;
  onUpdate: (updated: Device) => void;
  onDeleted: (deviceId: string) => void;
  onControlDisplay?: () => void;
}

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ deviceId, rooms, onClose, onUpdate, onDeleted, onControlDisplay, configurationOnly = false }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<DeviceInspectorTab>('info');
  const inspector = useDeviceInspector({ deviceId, configurationOnly, onClose, onUpdate, onDeleted });
  const {
    device, logs, loading, isRefreshing, isActionLoading, error, isRenaming, newName,
    showUnassignConfirm, showDeleteConfirm,
  } = inspector;

  const isOnline = device ? isDeviceOnline(device.updatedAt) : false;
  const unavailable = device ? isDeviceUnavailable(device) : true;

  return (
    <>
      <Drawer
        isOpen
        onClose={onClose}
        ariaLabel={t('inbox.inspector.title')}
        panelClassName="max-w-lg"
        hideCloseButton={!loading && Boolean(device)}
      >
      {loading ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <DeviceInspectorSkeleton label={t('common.loading')} />
        </div>
      ) : device ? (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <DeviceInspectorHeader
          device={device}
          activeTab={activeTab}
          isRenaming={isRenaming}
          newName={newName}
          onNewNameChange={inspector.setNewName}
          onStartRename={() => inspector.setIsRenaming(true)}
          onSaveRename={inspector.handleRename}
          onCancelRename={inspector.cancelRename}
          onTabChange={setActiveTab}
          onClose={onClose}
        />

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
          {activeTab === 'info' && (
            <DeviceInspectorInfoTab
              device={device}
              rooms={rooms}
              unavailable={unavailable}
              isOnline={isOnline}
              isActionLoading={isActionLoading}
              isRefreshing={isRefreshing}
              error={error}
              onSemanticTypeChange={inspector.handleSemanticTypeChange}
              onInvertStateChange={inspector.handleInvertStateChange}
              onCommand={inspector.handleCommand}
              configurationOnly={configurationOnly}
              onRefresh={inspector.handleRefresh}
              onMove={inspector.handleMove}
              onUnassign={() => inspector.setShowUnassignConfirm(true)}
              onDelete={() => inspector.setShowDeleteConfirm(true)}
            />
          )}
          {activeTab === 'logs' && <DeviceInspectorLogsTab logs={logs} />}
          {activeTab === 'state' && <DeviceInspectorStateTab device={device} />}
          {activeTab === 'info' && configurationOnly && onControlDisplay && (
            <Button variant="outline" onClick={onControlDisplay} className="mt-4">
              {t('inbox.smart_display.manage_controls')}
            </Button>
          )}
        </div>

      </div>
      ) : <p role="alert" className="p-6">{error || t('common.errors.fetch_failed')}</p>}

      </Drawer>

      <ConfirmModal
        isOpen={showUnassignConfirm}
        onClose={() => inspector.setShowUnassignConfirm(false)}
        onConfirm={inspector.handleUnassign}
        title={t('inbox.inspector.actions.unassign')}
        description={t('inbox.inspector.actions.unassign_confirm')}
        variant="warning"
        isSubmitting={isActionLoading}
      />
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => inspector.setShowDeleteConfirm(false)}
        onConfirm={inspector.handleDelete}
        title={t('inbox.inspector.remove_import_title')}
        description={t('inbox.inspector.remove_import_confirm', { name: device?.name })}
        confirmText={t('common.delete')}
        variant="danger"
        isSubmitting={isActionLoading}
      />
    </>
  );
};
