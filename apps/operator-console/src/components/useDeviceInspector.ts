import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import type { ActivityLog, DeviceCommand, InspectableDevice } from './DeviceInspectorTabs';
import type { SnapshotDevice as Device } from '../stores/useDeviceSnapshotStore';

const API_URL = `${API_BASE_URL}/api/v1`;

interface Options {
  deviceId: string;
  configurationOnly: boolean;
  onClose: () => void;
  onUpdate: (updated: Device) => void;
  onDeleted: (deviceId: string) => void;
}

/** Loads one device with its activity log and owns every inspector action. */
export function useDeviceInspector({ deviceId, configurationOnly, onClose, onUpdate, onDeleted }: Options) {
  const { t } = useTranslation();
  const [device, setDevice] = useState<InspectableDevice | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const cancelRename = () => {
    setIsRenaming(false);
    if (device) setNewName(device.name);
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

  return {
    device,
    logs,
    loading,
    isRefreshing,
    isActionLoading,
    error,
    isRenaming,
    newName,
    showUnassignConfirm,
    showDeleteConfirm,
    setIsRenaming,
    setNewName,
    setShowUnassignConfirm,
    setShowDeleteConfirm,
    cancelRename,
    handleRename,
    handleSemanticTypeChange,
    handleInvertStateChange,
    handleCommand,
    handleUnassign,
    handleMove,
    handleRefresh,
    handleDelete,
  };
}
