import React, { useCallback, useEffect, useState } from 'react';
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
  X,
  Zap,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { cn } from '../lib/utils';
import type { SnapshotDevice as Device, SnapshotRoom as Room } from '../stores/useDeviceSnapshotStore';
import ConfirmModal from './ConfirmModal';
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
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const DeviceInspector: React.FC<DeviceInspectorProps> = ({ deviceId, rooms, onClose, onUpdate }) => {
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

  const handleCommand = async (command: 'turn_on' | 'turn_off' | 'toggle' | 'open' | 'close' | 'stop') => {
    if (!device || isActionLoading) return;
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

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-[100] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!device) return null;

  const isOnline = Date.now() - new Date(device.updatedAt || new Date()).getTime() < 300000;

  return (
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
                  <span className="text-[10px] font-black uppercase tracking-widest text-primary">{t('inbox.inspector.title')}</span>
                  {device.integrationSource === 'sonoff' ? (
                    <span className="text-[8px] bg-success/10 text-success px-2 py-0.5 rounded-full border border-success/20 font-black uppercase tracking-widest shadow-sm">{t('inbox.inspector.verified_edge')}</span>
                  ) : (
                    <span className="text-[9px] bg-primary/5 text-primary/60 px-1.5 py-0.5 rounded border border-primary/10 font-bold uppercase tracking-tighter">{t('inbox.inspector.alias_only')}</span>
                  )}
                </div>
                {isRenaming ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      className="bg-background border border-primary/40 rounded px-2 py-1 text-lg font-black outline-none focus:ring-2 focus:ring-primary/20"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                    />
                    <button onClick={handleRename} className="p-1 px-2 bg-primary text-primary-foreground text-[10px] font-black rounded uppercase">{t('common.save')}</button>
                    <button onClick={() => { setIsRenaming(false); setNewName(device.name); }} className="text-[10px] uppercase font-bold text-muted-foreground group">
                      <span className="border-b border-transparent group-hover:border-muted-foreground transition-all ml-1">{t('common.cancel')}</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group/title">
                    <h2 className="text-2xl font-black tracking-tight">{device.name}</h2>
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
                  'flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-5 bg-muted/20 border border-border rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                      <Database className="w-3 h-3" /> Entity ID
                    </span>
                  </div>
                  <span className="font-mono text-xs font-bold break-all">{device.externalId || device.id}</span>
                </div>
                <div className="p-5 bg-muted/20 border border-border rounded-[1.5rem] flex flex-col gap-2 shadow-inner">
                  <span className="text-[9px] font-black uppercase tracking-widest opacity-50 flex items-center gap-1.5">
                    <Settings className="w-3 h-3" /> Tipo técnico & Origen
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold uppercase truncate">{device.type}</span>
                    <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase bg-muted border border-border text-muted-foreground truncate">{device.integrationSource}</span>
                    {device.integrationSource === 'sonoff' && (
                      <div className="flex items-center gap-1 ml-auto">
                        <div className={cn('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-success animate-pulse' : 'bg-destructive')} />
                        <span className={cn('text-[8px] font-black uppercase', isOnline ? 'text-success' : 'text-destructive')}>
                          {isOnline ? t('common.online') : t('common.offline')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-5 bg-muted/20 border border-border rounded-[1.5rem] flex flex-col gap-2 shadow-inner relative">
                  <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-primary">
                    <Zap className="w-3 h-3" /> Función del dispositivo
                  </span>
                  <SelectField
                    disabled={isActionLoading}
                    loading={isActionLoading}
                    value={device.semanticType || 'automatic'}
                    onChange={(val) => handleSemanticTypeChange(val)}
                    options={[
                      { value: 'automatic', label: 'Automático' },
                      { value: 'light', label: 'Luz' },
                      { value: 'switch', label: 'Interruptor' },
                      { value: 'outlet', label: 'Enchufe' },
                      { value: 'cover', label: 'Cortina/Persiana' },
                      { value: 'sensor', label: 'Sensor' },
                      { value: 'unknown', label: 'Desconocido' },
                    ]}
                  />
                  <p className="text-[8px] text-muted-foreground/50 px-2 leading-relaxed">
                    Determina cómo el Asistente interpreta este dispositivo.
                  </p>
                </div>
              </div>

              <div className="mt-4 p-8 bg-black/5 border-2 border-dashed border-border/50 rounded-[2.5rem] flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-50">{t('inbox.inspector.actions_header')}</span>
                  <Activity className="w-4 h-4 opacity-20" />
                </div>

                {(device.type === 'light' || device.type === 'switch') && (
                  <div className="flex gap-4">
                    <button onClick={() => handleCommand('turn_on')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-primary/10 active:bg-primary/90">
                      {t('inbox.inspector.actions.force_on')}
                    </button>
                    <button onClick={() => handleCommand('turn_off')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-muted text-foreground hover:bg-muted/80 transition-colors active:scale-95">
                      {t('inbox.inspector.actions.force_off')}
                    </button>
                    <button onClick={() => handleCommand('toggle')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors active:scale-95">
                      {t('inbox.inspector.actions.toggle')}
                    </button>
                  </div>
                )}

                {device.type === 'cover' && (
                  <div className="flex gap-4">
                    <button onClick={() => handleCommand('open')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-primary text-primary-foreground hover:scale-[1.02] transition-transform active:scale-95 shadow-lg shadow-primary/10">
                      {t('inbox.inspector.actions.open')}
                    </button>
                    <button onClick={() => handleCommand('stop')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-muted text-foreground hover:bg-muted/80 transition-colors active:scale-95">
                      {t('inbox.inspector.actions.stop')}
                    </button>
                    <button onClick={() => handleCommand('close')} className="flex-1 py-4 rounded-2xl text-[10px] font-black tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors active:scale-95">
                      {t('inbox.inspector.actions.close')}
                    </button>
                  </div>
                )}

                {device.externalId.startsWith('ha:') && (
                  <div className="pt-6 border-t border-border/20 flex flex-col gap-4">
                    <button
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      className="w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-secondary text-secondary-foreground border border-border hover:bg-secondary/80 transition-all flex items-center justify-center gap-3 group"
                    >
                      <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
                      {isRefreshing ? t('inbox.discovery.importing') : t('inbox.discovery.refresh_hint')}
                    </button>
                    {error && (
                      <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl border border-destructive/20">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <p className="text-[10px] font-bold leading-tight uppercase tracking-tight">{error}</p>
                      </div>
                    )}
                  </div>
                )}

                {device.integrationSource === 'sonoff' && (
                  <div className="pt-6 border-t border-border/20 flex flex-col gap-4">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-success" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-success">{t('inbox.inspector.edge_active')}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-40">
                        <Clock className="w-3 h-3" />
                        <span className="text-[8px] font-black uppercase tracking-tighter">
                          {device.updatedAt ? new Date(device.updatedAt).toLocaleTimeString() : t('common.not_available')}
                        </span>
                      </div>
                    </div>
                    <div className="p-4 bg-success/5 border border-success/10 rounded-2xl">
                      <p className="text-[9px] font-bold leading-relaxed text-success/70 uppercase tracking-tight">
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
                        <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{t('inbox.inspector.placement')}</span>
                      </div>
                      <span className="text-sm font-bold truncate">{device.roomId || t('common.unassigned')}</span>
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
                        className="w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-destructive/5 text-destructive border border-destructive/10 hover:bg-destructive/10 transition-all flex items-center justify-center gap-2"
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
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">{t('inbox.inspector.home_cluster')}</span>
                  </div>
                  <span className="text-sm font-bold truncate">{device.homeId}</span>
                  <div className="mt-auto pt-4 text-[9px] text-muted-foreground opacity-30 italic leading-snug">
                    {device.integrationSource === 'sonoff'
                      ? t('inbox.inspector.edge_node_info')
                      : t('inbox.inspector.cluster_info')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex flex-col gap-3 animate-in slide-in-from-bottom-4 duration-500">
              {Array.isArray(logs) && logs.map((log, index) => (
                <div key={index} className="p-5 bg-muted/10 border border-border/20 rounded-[1.5rem] flex flex-col gap-2 group hover:bg-muted/20 transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black px-2 py-0.5 rounded bg-primary/10 text-primary uppercase tracking-tighter">
                      {log.type}
                    </span>
                    <span className="text-[9px] font-mono opacity-40 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight mt-1 text-card-foreground/80">{log.description}</p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-20 flex flex-col items-center justify-center opacity-10">
                  <Terminal className="w-12 h-12 mb-4" />
                  <div className="text-xs font-black uppercase tracking-[0.2em]">{t('inbox.inspector.no_logs')}</div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'state' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500 h-full">
              <div className="flex-1 bg-[#0D0D0D] rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-4 right-8 text-[9px] font-black font-mono opacity-20 tracking-widest group-hover:opacity-40 transition-opacity">{t('inbox.inspector.json_parser_hint')}</div>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <pre className="text-[11px] font-mono text-success overflow-auto h-full leading-relaxed custom-scrollbar relative z-10 selection:bg-primary/30">
                  {JSON.stringify(device.lastKnownState, null, 4)}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border/50 bg-muted/10 text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-20">{t('inbox.inspector.data_object')}</p>
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
    </div>
  );
};
