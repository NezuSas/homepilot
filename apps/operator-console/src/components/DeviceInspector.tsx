import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertCircle,
  Box,
  Clock,
  Cpu,
  Database,
  Loader2,
  RadioTower,
  RefreshCw,
  Settings,
  Terminal,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { cn } from '../lib/utils';
import { isDeviceUnavailable } from '../lib/deviceAvailability';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from './ConfirmModal';
import { Button } from './ui/Button';
import { SelectField } from './ui/SelectField';

type InspectableDevice = Device & {
  externalId: string;
};

interface ActivityLog {
  timestamp: string;
  deviceId: string;
  type: string;
  description: string;
  data: Record<string, unknown>;
}

interface DeviceInspectorProps {
  deviceId: string;
  rooms: Room[];
  onClose: () => void;
  onUpdate: (updated: Device) => void;
  onDeleted: (deviceId: string) => void;
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ deviceId, rooms, onClose, onUpdate, onDeleted }) => {
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

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle' | 'open' | 'close' | 'stop') => {
    if (!device || isDeviceUnavailable(device) || isActionLoading) return;
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

  if (loading) {
    return createPortal(
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>,
      document.body
    );
  }

  if (!device) return null;

  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;
  const unavailable = isDeviceUnavailable(device);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-card border-l border-border flex flex-col shadow-2xl animate-in slide-in-from-right duration-500">
        <div className="p-8 bg-muted/30 border-b border-border relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 text-primary rounded-xl">
                <RadioTower className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-micro font-black uppercase tracking-widest text-primary">{t('inbox.inspector.title')}</span>
                  {device.integrationSource === 'sonoff' ? (
                    <span className="text-nano bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20 font-black uppercase tracking-widest shadow-sm">{t('inbox.inspector.verified_edge')}</span>
                  ) : (
                    <span className="text-micro bg-primary/5 text-primary/60 px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-tighter">{t('inbox.inspector.alias_only')}</span>
                  )}
                </div>
                {isRenaming ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="bg-background border border-primary/40 rounded px-2 py-1 text-section-title font-black outline-none focus:ring-2 focus:ring-primary/20"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                    <button onClick={handleRename} className="p-1 px-2 bg-primary text-primary-foreground text-micro font-black rounded uppercase">{t('common.save')}</button>
                    <button onClick={() => { setIsRenaming(false); setNewName(device.name); }} className="text-micro uppercase font-bold text-muted-foreground group">
                      <span className="border-b border-transparent group-hover:border-muted-foreground transition-all ml-1">{t('common.cancel')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h2 className="text-view-title font-black tracking-tight">{device.name}</h2>
                    <button
                      onClick={() => setIsRenaming(true)}
                      className="p-1 opacity-0 group-hover/title:opacity-100 transition-opacity hover:bg-muted rounded text-muted-foreground"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex gap-4 p-1 bg-muted/50 rounded-2xl border border-border/50">
            {(['info', 'logs', 'state'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3 rounded-xl text-micro font-black uppercase tracking-widest transition-all',
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {t(`inbox.inspector.tabs.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeTab === 'info' && (
            <div className="flex flex-col gap-8 animate-in slide-in-from-bottom-4 duration-500">
              {unavailable && (
                <div className="flex items-start gap-3 rounded-panel border border-danger/30 bg-danger/10 p-4 text-danger">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-label font-black uppercase tracking-widest">{t('common.unavailable')}</p>
                    <p className="mt-1 text-caption text-foreground/75">{t('common.device_unavailable_hint')}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-micro font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                      <Database className="w-3 h-3" /> Entity ID
                    </span>
                  </div>
                  <span className="font-mono text-caption font-bold break-all">{device.externalId || device.id}</span>
                </div>
                <div className="p-5 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner">
                  <span className="text-micro font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> {t('inbox.device_inspector.technical_origin')}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-caption font-bold uppercase truncate">{device.type}</span>
                    <span className="px-2 py-0.5 rounded-full text-nano font-black uppercase bg-muted border border-border text-muted-foreground truncate">{device.integrationSource}</span>
                    {device.integrationSource === 'sonoff' && (
                      <div className="flex items-center gap-1 ml-auto">
                        <div className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-destructive')} />
                        <span className={cn('text-nano font-black uppercase', isOnline ? 'text-success' : 'text-destructive')}>
                          {isOnline ? t('common.online') : t('common.offline')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-5 bg-muted/20 border border-border rounded-section flex flex-col gap-2 shadow-inner relative">
                  <span className="text-micro font-black uppercase tracking-widest flex items-center gap-1.5 text-primary">
                    <Zap className="w-3 h-3" /> {t('inbox.device_inspector.device_function')}
                  </span>
                  <SelectField
                    disabled={isActionLoading}
                    loading={isActionLoading}
                    value={device.semanticType || 'automatic'}
                    onChange={(val) => handleSemanticTypeChange(val)}
                    options={[
                      { value: 'automatic', label: t('inbox.device_inspector.semantic.automatic') },
                      { value: 'light', label: t('inbox.device_inspector.semantic.light') },
                      { value: 'switch', label: t('inbox.device_inspector.semantic.switch') },
                      { value: 'outlet', label: t('inbox.device_inspector.semantic.outlet') },
                      { value: 'cover', label: t('inbox.device_inspector.semantic.cover') },
                      { value: 'camera', label: t('inbox.device_inspector.semantic.camera') },
                      { value: 'sensor', label: t('inbox.device_inspector.semantic.sensor') },
                      { value: 'unknown', label: t('inbox.device_inspector.semantic.unknown') },
                    ]}
                  />
                  <p className="text-nano text-muted-foreground/50 px-2 leading-relaxed">
                    {t('inbox.device_inspector.semantic_hint')}
                  </p>
                </div>

                {device.type === 'cover' && (
                  <div className="p-5 bg-muted/20 border border-border rounded-section flex flex-col gap-3 shadow-inner">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <span className="text-micro font-black uppercase tracking-widest text-primary">
                          {t('inbox.device_inspector.cover_inverted')}
                        </span>
                        <p className="mt-1 text-nano text-muted-foreground/50 leading-relaxed">
                          {t('inbox.device_inspector.cover_inverted_hint')}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={device.invertState === true}
                        disabled={isActionLoading}
                        onClick={() => handleInvertStateChange(device.invertState !== true)}
                        className={cn(
                          'relative h-8 w-14 shrink-0 rounded-full border control-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                          device.invertState
                            ? 'border-primary/40 bg-primary/25'
                            : 'border-border bg-muted/60',
                          isActionLoading && 'pointer-events-none opacity-50',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 h-6 w-6 rounded-full bg-background shadow-sm surface-transition',
                            device.invertState ? 'left-7 bg-primary' : 'left-1',
                          )}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 p-8 bg-black/5 border-2 border-dashed border-border/50 rounded-dashboard flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="text-micro font-black uppercase tracking-widest opacity-50">{t('inbox.inspector.actions_header')}</span>
                  <Activity className="w-4 h-4 opacity-20" />
                </div>

                {(device.type === 'light' || device.type === 'switch') && (
                  <div className="flex gap-4">
                    <Button disabled={unavailable || isActionLoading} onClick={() => handleCommand('turn_on')} className="flex-1 h-12 text-micro font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.force_on')}
                    </Button>
                    <Button disabled={unavailable || isActionLoading} variant="secondary" onClick={() => handleCommand('turn_off')} className="flex-1 h-12 text-micro font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.force_off')}
                    </Button>
                    <Button disabled={unavailable || isActionLoading} variant="outline" onClick={() => handleCommand('toggle')} className="flex-1 h-12 text-micro font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.toggle')}
                    </Button>
                  </div>
                )}

                {device.type === 'cover' && (
                  <div className="flex gap-4">
                    <Button disabled={unavailable || isActionLoading} onClick={() => handleCommand('open')} className="flex-1 h-12 text-label font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.open')}
                    </Button>
                    <Button disabled={unavailable || isActionLoading} variant="secondary" onClick={() => handleCommand('stop')} className="flex-1 h-12 text-label font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.stop')}
                    </Button>
                    <Button disabled={unavailable || isActionLoading} variant="outline" onClick={() => handleCommand('close')} className="flex-1 h-12 text-label font-black uppercase tracking-widest">
                      {t('inbox.inspector.actions.close')}
                    </Button>
                  </div>
                )}

                {device.externalId.startsWith('ha:') && (
                  <div className="pt-6 border-t border-border/20 flex flex-col gap-4">
                    <Button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      variant="secondary"
                      className="w-full h-12 text-micro font-black uppercase tracking-widest"
                    >
                      <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                      {isRefreshing ? t('inbox.discovery.importing') : t('inbox.discovery.refresh_hint')}
                    </Button>
                    {error && (
                      <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="text-micro font-bold leading-tight uppercase tracking-tight">{error}</p>
                      </div>
                    )}
                  </div>
                )}

                {device.integrationSource === 'sonoff' && (
                  <div className="pt-6 border-t border-border/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-success" />
                        <span className="text-micro font-black uppercase tracking-widest text-success">{t('inbox.inspector.edge_active')}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-40">
                        <Clock className="w-3 h-3" />
                        <span className="text-nano font-black uppercase tracking-tighter">
                          {device.updatedAt ? new Date(device.updatedAt).toLocaleTimeString() : t('common.not_available')}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-success/5 border border-success/10 rounded-2xl">
                      <p className="text-micro font-bold leading-relaxed text-success/70 uppercase tracking-tight">
                        {t('inbox.inspector.edge_description')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 border border-border rounded-2xl bg-card flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Box className="w-4 h-4 opacity-40 text-primary" />
                        <span className="text-micro font-black uppercase tracking-widest opacity-40">{t('inbox.inspector.placement')}</span>
                      </div>
                      <span className="text-body font-bold truncate">{device.roomId || t('common.unassigned')}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/10 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <SelectField
                        variant="small"
                        fullWidth
                        value={device.roomId || ''}
                        onChange={handleMove}
                        disabled={isActionLoading}
                        loading={isActionLoading}
                        options={Array.isArray(rooms) ? rooms.map((room) => ({ value: room.id, label: room.name })) : []}
                        placeholder={t('common.unassigned')}
                      />
                    </div>

                    {device.status === 'ASSIGNED' && (
                      <button
                        onClick={() => setShowUnassignConfirm(true)}
                        disabled={isActionLoading}
                        className="w-full py-2.5 rounded-xl text-micro font-black uppercase tracking-widest bg-destructive/5 text-destructive border border-destructive/10 hover:bg-destructive/10 transition-all flex items-center justify-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t('inbox.inspector.actions.unassign')}
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-6 border border-border rounded-2xl bg-card flex flex-col gap-1 shadow-sm">
                  <div className="flex items-center gap-2 mb-2 text-primary">
                    <Cpu className="w-4 h-4 opacity-40" />
                    <span className="text-micro font-black uppercase tracking-widest opacity-40">{t('inbox.inspector.home_cluster')}</span>
                  </div>
                  <span className="text-body font-bold truncate">{device.homeId}</span>
                  <div className="mt-auto pt-4 text-micro text-muted-foreground opacity-30 italic leading-snug">
                    {device.integrationSource === 'sonoff'
                      ? t('inbox.inspector.edge_node_info')
                      : t('inbox.inspector.cluster_info')}
                  </div>
                </div>
              </div>

              {device.externalId.startsWith('ha:') && (
                <div className="rounded-panel border border-destructive/20 bg-destructive/5 p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-card-title font-black text-destructive">
                        {t('inbox.inspector.remove_import_title')}
                      </h3>
                      <p className="mt-1 text-body text-muted-foreground">
                        {t('inbox.inspector.remove_import_description')}
                      </p>
                    </div>
                    <Button
                      variant="danger"
                      onClick={() => setShowDeleteConfirm(true)}
                      disabled={isActionLoading}
                      className="shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-500">
              {Array.isArray(logs) && logs.map((log, index) => (
                <div key={index} className="p-5 bg-muted/10 border border-border/20 rounded-section flex flex-col gap-2 group hover:bg-muted/20 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-micro font-black px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-tighter">
                      {log.type}
                    </span>
                    <span className="text-micro font-mono opacity-40 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-caption font-bold leading-tight mt-1 text-card-foreground/80">{log.description}</p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center opacity-10">
                  <Terminal className="w-12 h-12 mb-4" />
                  <div className="text-caption font-black uppercase tracking-label">{t('inbox.inspector.no_logs')}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'state' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 h-full">
              <div className="flex-1 rounded-dashboard border border-white/5 bg-background p-8 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-4 right-8 text-micro font-black font-mono opacity-20 tracking-widest group-hover:opacity-40 transition-opacity">{t('inbox.inspector.json_parser_hint')}</div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <pre className="text-label font-mono text-success overflow-auto h-full leading-relaxed custom-scrollbar relative z-10 selection:bg-primary/30">
                  {JSON.stringify(device.lastKnownState, null, 4)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border/50 bg-muted/10 text-center">
          <p className="text-micro font-black uppercase tracking-label-wider opacity-20">{t('inbox.inspector.data_object')}</p>
        </div>
      </div>

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
        description={t('inbox.inspector.remove_import_confirm', { name: device.name })}
        confirmText={t('common.delete')}
        variant="danger"
        isSubmitting={isActionLoading}
      />
    </div>,
    document.body
  );
};
