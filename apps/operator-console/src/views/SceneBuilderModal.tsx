import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, PlayCircle, List, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { humanize } from '../lib/naming-utils';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { Button } from '../components/ui/Button';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Input, SearchInput } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
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

  return (
    <Modal
      isOpen
      onClose={saving ? undefined : onClose}
      title={existingScene ? t('scenes.builder.title_edit') : t('scenes.builder.title_create')}
      description={t('scenes.builder.subtitle')}
      headerAlign="start"
      headerClassName="pb-3 sm:pb-4"
      contentClassName="pt-2 sm:pt-2"
      className="max-w-2xl"
      layerClassName="z-[200]"
      hideCloseButton={saving}
      footer={(
        <div className="w-full p-5 sm:p-6">
          <Button
            disabled={!name || actions.length === 0 || saving}
            onClick={handleSave}
            isLoading={saving}
            className="w-full rounded-panel py-4 text-caption font-black uppercase tracking-label-wider shadow-primary/20 sm:py-5"
          >
            {!saving && <Save className="h-5 w-5" />}
            {t('scenes.builder.commit')}
          </Button>
        </div>
      )}
    >
      <div className="space-y-5 sm:space-y-6">
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
                <Input
                  label={t('scenes.builder.placeholders.name')}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('scenes.builder.placeholders.name')}
                  className="h-12 border-foreground/10 bg-foreground/[0.03] px-4 text-body-lg font-black tracking-tight placeholder:opacity-35"
                  autoFocus
                />
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

             <Input
               containerClassName="mt-2"
               label={t('scenes.builder.placeholders.description')}
               type="text"
               value={description}
               onChange={(e) => setDescription(e.target.value)}
               placeholder={t('scenes.builder.placeholders.description')}
               className="h-12 border-foreground/10 bg-foreground/[0.03] px-4 text-body font-medium placeholder:opacity-20"
             />
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
                <SearchInput
                  containerClassName="w-full min-[460px]:w-52"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                  placeholder={t('common.search')}
                  className="h-9 rounded-lg border-none bg-primary/5 text-caption font-bold focus-visible:ring-1"
                />
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
                          <div className="w-full min-[520px]:w-52" onClick={e => e.stopPropagation()}>
                            <SegmentedControl<'activate' | 'deactivate'>
                              value={action?.command === 'turn_on' || action?.command === 'open' ? 'activate' : 'deactivate'}
                              onChange={(value) => setCommand(
                                d.id,
                                value === 'activate'
                                  ? (isCoverDevice(d) ? 'open' : 'turn_on')
                                  : (isCoverDevice(d) ? 'close' : 'turn_off'),
                              )}
                              options={[
                                { value: 'activate', label: isCoverDevice(d) ? t('common.actions.open') : t('common.on') },
                                { value: 'deactivate', label: isCoverDevice(d) ? t('common.actions.close') : t('common.off') },
                              ]}
                              tone="primary"
                              className="w-full rounded-lg p-1"
                              optionClassName="min-h-9 px-2 py-1.5 text-nano font-black tracking-widest"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
             )}
          </div>

      </div>
    </Modal>
  );
};
