import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { X, Save, PlayCircle, Loader2, List, Settings, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { humanize } from '../lib/naming-utils';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import { canExecuteCommand, hasCapability } from '../lib/deviceCapabilities';

const API_URL = `${API_BASE_URL}/api/v1`;

interface Room {
  id: string;
  name: string;
}

interface SceneAction {
  deviceId: string;
  command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  description?: string;
  actions: SceneAction[];
}

interface SceneBuilderModalProps {
  onClose: () => void;
  onSaved: () => void;
  homeId: string;
  rooms: Room[];
  devices: SnapshotDevice[];
  initialRoomId?: string | null;
  existingScene?: Scene | null;
}

export const SceneBuilderModal: React.FC<SceneBuilderModalProps> = ({ onClose, onSaved, homeId, rooms, devices, initialRoomId = null, existingScene }) => {
  const { t } = useTranslation();
  const [name, setName] = useState(existingScene?.name || '');
  const [description, setDescription] = useState(existingScene?.description || '');
  const [roomId, setRoomId] = useState<string | null>(existingScene ? existingScene.roomId : initialRoomId);
  const [actions, setActions] = useState<SceneAction[]>(existingScene?.actions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState('');

  const isCoverDevice = (device: SnapshotDevice) => hasCapability(device, 'cover') || device.semanticType === 'cover' || device.type === 'cover';
  const isPowerDevice = (device: SnapshotDevice) => (
    hasCapability(device, 'light')
    || hasCapability(device, 'switch')
    || device.semanticType === 'light'
    || device.semanticType === 'switch'
    || device.semanticType === 'outlet'
    || ['light', 'switch', 'outlet'].includes(device.type)
  );
  const controllableDevices = devices.filter(device => (
    (isCoverDevice(device) && (canExecuteCommand(device, 'open') || canExecuteCommand(device, 'close')))
    || (isPowerDevice(device) && (canExecuteCommand(device, 'turn_on') || canExecuteCommand(device, 'turn_off')))
  ));
  let availableDevices = roomId ? controllableDevices.filter(d => d.roomId === roomId) : controllableDevices;
  
  if (deviceSearch) {
    availableDevices = availableDevices.filter(d => 
      humanize(d.id, d.name).toLowerCase().includes(deviceSearch.toLowerCase())
    );
  }

  const toggleDevice = (deviceId: string) => {
    const exists = actions.find(a => a.deviceId === deviceId);
    if (exists) {
      setActions(actions.filter(a => a.deviceId !== deviceId));
    } else {
      const device = devices.find(d => d.id === deviceId);
      if (!device) return;
      const defaultCommand: SceneAction['command'] = isCoverDevice(device) ? 'open' : 'turn_on';
      setActions([...actions, { deviceId, command: defaultCommand }]);
    }
  };

  const setCommand = (deviceId: string, command: 'turn_on' | 'turn_off' | 'open' | 'close' | 'stop') => {
    setActions(actions.map(a => a.deviceId === deviceId ? { ...a, command } : a));
  };

  const handleSave = async () => {
    if (!name.trim()) return setError(t('scenes.builder.errors.no_name'));
    if (actions.length === 0) return setError(t('scenes.builder.errors.no_actions'));

    setSaving(true);
    setError(null);
    try {
      const payload = {
        homeId,
        roomId,
        name: name.trim(),
        description: description.trim(),
        actions
      };

      const url = existingScene 
        ? `${API_URL}/scenes/${existingScene.id}` 
        : `${API_URL}/scenes`;
      
      const res = await apiFetch(url, {
        method: existingScene ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(await readApiError(res, t('scenes.builder.errors.sync_failed')));
      onSaved();
    } catch (error_: unknown) {
      setError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative flex max-h-viewport-modal w-full max-w-2xl flex-col overflow-hidden rounded-panel border-2 border-border/40 bg-card/60 shadow-scene-modal backdrop-blur-2xl animate-in zoom-in-95 duration-500 sm:max-h-viewport-panel-sm sm:rounded-hero">
        
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 pb-3 pt-5 sm:px-8 sm:pb-4 sm:pt-8">
          <div className="min-w-0">
            <h2 className="truncate text-panel-title font-black tracking-tighter sm:text-view-title">
              {existingScene ? t('scenes.builder.title_edit') : t('scenes.builder.title_create')}
            </h2>
            <p className="text-micro font-black uppercase tracking-label text-muted-foreground opacity-50 mt-1">
              {t('scenes.builder.subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-xl bg-muted/40 p-3 transition-all hover:bg-muted">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 pt-2 custom-scrollbar sm:space-y-6 sm:p-8 sm:pt-2">
          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-shake">
              <X className="w-4 h-4 shrink-0" />
              <p className="text-micro font-black uppercase tracking-wider leading-none">{error}</p>
            </div>
          )}

          {/* Identity Section */}
          <div className="relative space-y-4 rounded-section border border-border/10 bg-muted/10 p-4 sm:rounded-panel sm:p-6">
             <div className="flex items-center gap-3 mb-2">
                <div className="h-8 px-3 rounded-full bg-background border flex items-center justify-center shrink-0">
                  <Settings className="w-3 h-3 text-foreground/40" />
                </div>
                <label className="text-micro font-black uppercase tracking-label-wider text-muted-foreground opacity-60">{t('scenes.builder.identity')}</label>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-nano font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('scenes.builder.placeholders.name')}</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('scenes.builder.placeholders.name')}
                    className="w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-3 text-body-lg font-black tracking-tight focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-35"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-nano font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('scenes.builder.scope')}</label>
                  <SearchableSelectField
                    value={roomId || ''} 
                    onChange={(val) => {
                      setRoomId(val || null);
                      setActions([]);
                    }}
                    options={[
                      { value: '', label: t('dashboard.scene_global') },
                      ...rooms.map(r => ({ value: r.id, label: r.name.toUpperCase() }))
                    ]}
                    placeholder={t('dashboard.scene_global')}
                  />
                </div>
             </div>

             <div className="space-y-2 mt-2">
                <label className="text-nano font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('scenes.builder.placeholders.description')}</label>
                <input 
                  type="text" 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('scenes.builder.placeholders.description')}
                  className="w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-3 text-body font-medium focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20"
                />
             </div>
          </div>

          {/* Device Selection Section */}
          <div className="relative space-y-4 rounded-section border border-primary/10 bg-primary/[0.02] p-4 sm:rounded-panel sm:p-6">
             <div className="mb-2 flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-center min-[460px]:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-8 px-3 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <List className="w-3 h-3" />
                  </div>
                  <label className="text-micro font-black uppercase tracking-label-wider text-primary/60">
                    {t('scenes.builder.select_units', { count: actions.length })}
                  </label>
                </div>
                <div className="relative w-full min-[460px]:w-auto">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-primary/40" />
                   <input 
                    type="text"
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    placeholder={t('common.search')}
                    className="w-full rounded-lg border-none bg-primary/5 py-2 pl-8 pr-3 text-caption font-bold outline-none transition-all focus:ring-1 focus:ring-primary/20 min-[460px]:w-36 min-[460px]:focus:w-52"
                   />
                </div>
             </div>

             {availableDevices.length === 0 ? (
                <div className="p-8 text-center bg-primary/[0.03] border-2 border-dashed border-primary/10 rounded-2xl">
                  <p className="text-micro font-black uppercase tracking-widest text-primary/40">{t('dashboard.scene_no_devices')}</p>
                </div>
             ) : (
                <div className="grid grid-cols-1 gap-2">
                  {availableDevices.map(d => {
                    const action = actions.find(a => a.deviceId === d.id);
                    const isSelected = !!action;
                    
                    return (
                      <div key={d.id} className={cn(
                        "group flex cursor-pointer flex-col gap-3 rounded-2xl border p-3 transition-all duration-300 min-[520px]:flex-row min-[520px]:items-center min-[520px]:justify-between min-[520px]:gap-4",
                        isSelected ? "bg-primary/10 border-primary/30 shadow-lg" : "bg-foreground/[0.02] border-foreground/5 hover:border-primary/20"
                      )} onClick={() => toggleDevice(d.id)}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-700 shrink-0",
                            isSelected ? "bg-primary border-primary text-primary-foreground premium-glow shadow-primary/20" : "bg-background border-border/40 text-foreground/30"
                          )}>
                             <PlayCircle className={cn("w-5 h-5", isSelected && "animate-pulse")} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-body font-black tracking-tighter leading-none mb-1 truncate">{humanize(d.id, d.name)}</span>
                            <span className="text-nano font-black uppercase tracking-label text-muted-foreground opacity-40">
                               {(d.semanticType || d.type).toUpperCase()}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="grid w-full grid-cols-2 gap-1 min-[520px]:w-auto" onClick={e => e.stopPropagation()}>
                            <button 
                              onClick={() => setCommand(d.id, isCoverDevice(d) ? 'open' : 'turn_on')}
                              className={cn(
                                "px-3 py-2 rounded-lg text-nano font-black uppercase tracking-widest transition-all border",
                                action?.command === 'turn_on' || action?.command === 'open' 
                                  ? "bg-primary border-primary text-primary-foreground shadow-lg" 
                                  : "bg-background border-border/40 text-foreground/40 hover:text-foreground"
                              )}
                            >
                               {isCoverDevice(d) ? t('common.actions.open') : t('common.on')}
                            </button>
                            <button 
                              onClick={() => setCommand(d.id, isCoverDevice(d) ? 'close' : 'turn_off')}
                              className={cn(
                                "px-3 py-2 rounded-lg text-nano font-black uppercase tracking-widest transition-all border",
                                action?.command === 'turn_off' || action?.command === 'close' 
                                  ? "bg-primary border-primary text-primary-foreground shadow-lg" 
                                  : "bg-background border-border/40 text-foreground/40 hover:text-foreground"
                              )}
                            >
                               {isCoverDevice(d) ? t('common.actions.close') : t('common.off')}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
             )}
          </div>

          {/* Footer - Integrated Action Button */}
          <div className="pt-2 pb-4">
            <button 
              disabled={saving || !name || actions.length === 0}
              onClick={handleSave}
              className="w-full bg-primary text-primary-foreground py-5 rounded-panel font-black text-caption uppercase tracking-label-wider transition-all hover:scale-[1.02] active:scale-95 premium-glow shadow-primary/20 flex items-center justify-center gap-4 disabled:opacity-30 disabled:hover:scale-100"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('scenes.builder.commit')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
