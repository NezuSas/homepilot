import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RadioTower, Settings, X } from 'lucide-react';
import { DeviceInspectorSkeleton } from './ui/ComponentSkeletons';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import { DeviceInspectorInfoTab, DeviceInspectorLogsTab, DeviceInspectorStateTab } from './DeviceInspectorTabs';
import type { ActivityLog, DeviceCommand, InspectableDevice } from './DeviceInspectorTabs';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from './ConfirmModal';
import { Button } from './ui/Button';
import { IconButton } from './ui/IconButton';
import { Input } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
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

const API_URL = `${API_BASE_URL}/api/v1`;

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ deviceId, rooms, onClose, onUpdate, onDeleted, onControlDisplay, configurationOnly = false }) => {
  const { t } = useTranslation();
  const [device, setDevice] = useState<InspectableDevice | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'logs' | 'state'>('info');
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [showUnassignConfirm, setShowUnassignConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const fetchDetails = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [devRes, logsRes] = await Promise.all([
        apiFetch(`${API_URL}/devices/${deviceId}`),
        apiFetch(`${API_URL}/devices/${deviceId}/activity-logs`),
      ]);
      if (devRes.ok) {
        const devData = await devRes.json() as InspectableDevice;
        setDevice(devData);
        setNewName(devData.name);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json() as ActivityLog[];
        setLogs(logsData);
      }
    } catch {
      setError(t('common.errors.fetch_failed'));
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [deviceId, t]);

  useEffect(() => {
    fetchDetails(true);
  }, [fetchDetails]);

  const handleRename = async () => {
    if (!device || !newName.trim() || newName === device.name) {
      setIsRenaming(false);
      return;
    }
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
        setIsRenaming(false);
      }
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSemanticTypeChange = async (semanticType: string) => {
    if (!device || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const payload = semanticType === 'automatic' ? null : semanticType;
      const res = await apiFetch(`${API_URL}/devices/${device.id}/semantic-type`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semanticType: payload }),
      });
      if (res.ok) {
        const data = await res.json() as { device: InspectableDevice };
        setDevice(data.device);
        onUpdate(data.device);
      } else {
        setError(t('common.errors.operation_failed'));
      }
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleInvertStateChange = async (invertState: boolean) => {
    if (!device || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invertState }),
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
      } else {
        setError(t('common.errors.operation_failed'));
      }
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCommand = async (command: DeviceCommand) => {
    if (configurationOnly || !device || isDeviceUnavailable(device) || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
      }
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleUnassign = async () => {
    if (!device || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: null }),
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
        setShowUnassignConfirm(false);
        onClose();
      }
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleMove = async (newRoomId: string) => {
    if (!device || !newRoomId || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: newRoomId }),
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
      }
    } catch {
      setError(t('common.errors.operation_failed'));
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!device || isRefreshing) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}/refresh`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = await res.json() as InspectableDevice;
        setDevice(updated);
        onUpdate(updated);
      } else {
        const data = await res.json() as { error: string };
        throw new Error(data.error || t('inbox.discovery.refresh_failed'));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('ha_settings.messages.network_error');
      setError(msg);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!device || isActionLoading) return;
    setIsActionLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${API_URL}/devices/${device.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: { message?: string } };
        throw new Error(data.error?.message || t('inbox.inspector.delete_failed'));
      }

      setShowDeleteConfirm(false);
      onDeleted(device.id);
      onClose();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : t('inbox.inspector.delete_failed'));
      setShowDeleteConfirm(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  const isOnline = device ? Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000 : false;
  const unavailable = device ? isDeviceUnavailable(device) : true;

  return (
    <>
      <Drawer
        isOpen
        onClose={onClose}
        ariaLabel={t('inbox.inspector.title')}
        hideCloseButton={!loading && Boolean(device)}
      >
      {loading ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <DeviceInspectorSkeleton label={t('common.loading')} />
        </div>
      ) : device ? (
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="relative border-b border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-start justify-between gap-3 sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <RadioTower className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="text-micro font-black uppercase tracking-widest text-primary">{t('inbox.inspector.title')}</span>
                  {device.integrationSource === 'sonoff' ? (
                    <span className="text-nano bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20 font-black uppercase tracking-widest shadow-sm">{t('inbox.inspector.verified_edge')}</span>
                  ) : (
                    <span className="text-micro bg-primary/5 text-primary/60 px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-tighter">{t('inbox.inspector.alias_only')}</span>
                  )}
                </div>
                {isRenaming ? (
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      containerClassName="w-44"
                      className="h-8 rounded border-primary/40 px-2 py-1 text-section-title font-black"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                    <Button size="xs" onClick={handleRename}>{t('common.save')}</Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => { setIsRenaming(false); setNewName(device.name); }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-2 group/title">
                    <h2 className="min-w-0 break-words text-panel-title font-black tracking-tight">{device.name}</h2>
                    <IconButton
                      icon={Settings}
                      label={t('common.edit')}
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRenaming(true)}
                      className="opacity-0 group-hover/title:opacity-100"
                    />
                  </div>
                )}
              </div>
            </div>
            <IconButton
              icon={X}
              label={t('common.close')}
              variant="ghost"
              size="lg"
              onClick={onClose}
              className="hover:bg-danger/10 hover:text-danger"
            />
          </div>

          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            label={t('inbox.inspector.title')}
            tone="primary"
            className="grid grid-cols-3 gap-1 rounded-2xl p-1"
            options={(['info', 'logs', 'state'] as const).map((value) => ({
              value,
              label: t(`inbox.inspector.tabs.${value}`),
            }))}
          />
        </div>

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
              onSemanticTypeChange={handleSemanticTypeChange}
              onInvertStateChange={handleInvertStateChange}
              onCommand={handleCommand}
              configurationOnly={configurationOnly}
              onRefresh={handleRefresh}
              onMove={handleMove}
              onUnassign={() => setShowUnassignConfirm(true)}
              onDelete={() => setShowDeleteConfirm(true)}
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

        <div className="px-4 py-3 border-t border-border/50 bg-muted/10 text-center">
          <p className="text-micro font-black uppercase tracking-label-wider opacity-20">{t('inbox.inspector.data_object')}</p>
        </div>
      </div>
      ) : <p role="alert" className="p-6">{error || t('common.errors.fetch_failed')}</p>}

      </Drawer>

      <ConfirmModal
        isOpen={showUnassignConfirm}
        onClose={() => setShowUnassignConfirm(false)}
        onConfirm={handleUnassign}
        title={t('inbox.inspector.actions.unassign')}
        description={t('inbox.inspector.actions.unassign_confirm')}
        variant="warning"
        isSubmitting={isActionLoading}
      />
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title={t('inbox.inspector.remove_import_title')}
        description={t('inbox.inspector.remove_import_confirm', { name: device?.name })}
        confirmText={t('common.delete')}
        variant="danger"
        isSubmitting={isActionLoading}
      />
    </>
  );
};
