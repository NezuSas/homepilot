import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, PlayCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { humanize } from '../lib/naming-utils';
import { Input } from '../components/ui/Input';
import Select from './Select';
import { Button } from '../components/ui/Button';

const API_URL = `${API_BASE_URL}/api/v1`;

interface Device {
  id: string;
  name: string;
  type: string;
  roomId: string | null;
}

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
  devices: Device[];
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

  const controllableDevices = devices.filter(d => ['light', 'switch', 'cover'].includes(d.type));
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
      const defaultCommand = device?.type === 'cover' ? 'open' : 'turn_on';
      setActions([...actions, { deviceId, command: defaultCommand as any }]);
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

      if (!res.ok) throw new Error(t('scenes.builder.errors.sync_failed'));
      onSaved();
    } catch (e: any) {
      setError(e.message || t('common.errors.operation_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative bg-card/60 backdrop-blur-2xl w-full max-w-2xl max-h-[85vh] border-2 border-border/40 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header - Condensed */}
        <div className="flex items-center justify-between px-8 pt-8 pb-4 shrink-0">
          <div>
            <h2 className="text-2xl font-black tracking-tighter leading-none mb-1">
              {existingScene ? t('scenes.builder.title_edit') : t('scenes.builder.title_create')}
            </h2>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{t('scenes.builder.subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-3 bg-muted/40 hover:bg-muted rounded-xl transition-all">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 pt-2 flex flex-col gap-6 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-shake">
              <X className="w-4 h-4 shrink-0" />
              <p className="font-black text-[10px] uppercase tracking-wider">{error}</p>
            </div>
          )}

          {/* Name & Scope Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
               <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.identity')}</label>
               <Input 
                 value={name} 
                 onChange={e => setName(e.target.value)} 
                 placeholder={t('scenes.builder.placeholders.name')}
                 className="text-lg font-black tracking-tighter rounded-xl"
               />
            </div>
            <div className="space-y-3">
               <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.scope')}</label>
               <Select 
                 searchable
                 value={roomId || ''} 
                 onChange={(val) => {
                   setRoomId(val || null);
                   setActions([]);
                 }}
                 options={[
                   { value: '', label: t('dashboard.scene_global') },
                   ...rooms.map(r => ({ value: r.id, label: r.name.toUpperCase() }))
                 ]}
                 placeholder="Select Room..."
               />
            </div>
          </div>

          <div className="space-y-3">
             <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.intent')}</label>
             <Input 
               value={description} 
               onChange={e => setDescription(e.target.value)} 
               placeholder={t('scenes.builder.placeholders.description')}
               className="text-sm font-medium rounded-xl"
             />
          </div>

          {/* Device Selection Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.select_units', { count: actions.length })}</label>
               <div className="relative w-48">
                  <Input 
                    placeholder="Search units..."
                    value={deviceSearch}
                    onChange={e => setDeviceSearch(e.target.value)}
                    className="h-8 text-[10px] bg-muted/20 border-none rounded-lg pl-3"
                  />
               </div>
            </div>
            
            {availableDevices.length === 0 ? (
              <div className="p-8 text-center bg-muted/10 border-4 border-dashed border-border/20 rounded-[2rem]">
                <p className="text-xs font-bold text-muted-foreground opacity-40">{t('dashboard.scene_no_devices')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {availableDevices.map(d => {
                  const action = actions.find(a => a.deviceId === d.id);
                  const isSelected = !!action;
                  const deviceRoom = rooms.find(r => r.id === d.roomId);
                  
                  return (
                    <div key={d.id} className={cn(
                      "group relative overflow-hidden bg-muted/20 border transition-all duration-500 rounded-2xl",
                      isSelected ? "border-primary bg-primary/5 shadow-lg" : "border-border/30 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    )}>
                      <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={() => toggleDevice(d.id)}>
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            "w-10 h-10 rounded-xl border flex items-center justify-center transition-all duration-700 shrink-0",
                            isSelected ? "bg-primary border-primary text-primary-foreground premium-glow" : "bg-background border-border"
                          )}>
                             <PlayCircle className={cn("w-5 h-5", isSelected && "animate-pulse")} />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-black tracking-tight leading-none mb-1 truncate">{humanize(d.id, d.name)}</span>
                            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                               {deviceRoom ? deviceRoom.name : t('common.unassigned')}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                            <Button 
                              size="sm"
                              variant={action?.command === 'turn_on' || action?.command === 'open' ? "primary" : "secondary"}
                              onClick={() => setCommand(d.id, d.type === 'cover' ? 'open' : 'turn_on')}
                              className="px-4 py-2 text-[9px] font-black uppercase tracking-widest h-auto"
                            >
                              {d.type === 'cover' ? t('common.actions.open') : t('common.on')}
                            </Button>
                            <Button
                              size="sm"
                              variant={action?.command === 'turn_off' || action?.command === 'close' ? "primary" : "secondary"}
                              onClick={() => setCommand(d.id, d.type === 'cover' ? 'close' : 'turn_off')}
                              className="px-4 py-2 text-[9px] font-black uppercase tracking-widest h-auto"
                            >
                              {d.type === 'cover' ? t('common.actions.close') : t('common.off')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer - Condensed */}
        <div className="px-8 py-6 border-t border-border/20 bg-card flex gap-4 shrink-0">
          <Button 
            variant="secondary"
            onClick={onClose} 
            className="flex-1 py-4 h-auto text-[10px] font-black uppercase tracking-widest rounded-2xl"
          >
            {t('common.cancel')}
          </Button>
          <Button 
            variant="primary"
            onClick={handleSave} 
            disabled={saving || actions.length === 0 || !name}
            className="flex-[2] py-4 h-auto text-[10px] font-black uppercase tracking-widest rounded-2xl premium-glow"
            isLoading={saving}
          >
            {!saving && <Save className="w-4 h-4 mr-2 inline-block" />}
            {t('scenes.builder.commit')}
          </Button>
        </div>
      </div>
    </div>
  );
};
