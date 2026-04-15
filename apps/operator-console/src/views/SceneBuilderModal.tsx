import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, PlayCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';
import { humanize } from '../lib/naming-utils';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
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

  const controllableDevices = devices.filter(d => ['light', 'switch', 'cover'].includes(d.type));
  const availableDevices = roomId ? controllableDevices.filter(d => d.roomId === roomId) : controllableDevices;

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
      
      const res = await fetch(url, {
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
      
      <div className="relative bg-card/60 backdrop-blur-2xl w-full max-w-2xl max-h-[85vh] border-2 border-border/40 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header */}
        <div className="flex items-center justify-between p-12 pb-6 shrink-0">
          <div>
            <h2 className="text-3xl font-black tracking-tighter leading-none mb-2">
              {existingScene ? t('scenes.builder.title_edit') : t('scenes.builder.title_create')}
            </h2>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50">{t('scenes.builder.subtitle')}</p>
          </div>
          <button onClick={onClose} className="p-4 bg-muted/40 hover:bg-muted rounded-2xl transition-all">
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-12 pt-0 flex flex-col gap-10 custom-scrollbar">
          {error && (
            <div className="p-6 rounded-3xl bg-destructive/10 border border-destructive/20 flex items-center gap-4 text-destructive animate-shake">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <p className="font-black text-[10px] uppercase tracking-wider">{error}</p>
            </div>
          )}

          {/* Name & Scope Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.identity')}</label>
               <Input 
                 value={name} 
                 onChange={e => setName(e.target.value)} 
                 placeholder={t('scenes.builder.placeholders.name')}
                 className="text-xl font-black tracking-tighter"
               />
            </div>
            <div className="space-y-4">
               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.scope')}</label>
               <Select 
                 value={roomId || ''} 
                 onChange={e => {
                   setRoomId(e.target.value || null);
                   setActions([]);
                 }}
                 className="text-sm font-black tracking-widest uppercase"
               >
                 <option value="">{t('dashboard.scene_global')}</option>
                 {rooms.map(r => <option key={r.id} value={r.id}>{r.name.toUpperCase()}</option>)}
               </Select>
            </div>
          </div>

          <div className="space-y-4">
             <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.intent')}</label>
             <Input 
               value={description} 
               onChange={e => setDescription(e.target.value)} 
               placeholder={t('scenes.builder.placeholders.description')}
               className="text-sm font-medium"
             />
          </div>

          {/* Device Selection Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('scenes.builder.select_units', { count: actions.length })}</label>
               <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-primary/10 text-primary rounded-full">{t('scenes.builder.grouping_hint')}</span>
            </div>
            
            {availableDevices.length === 0 ? (
              <div className="p-10 text-center bg-muted/10 border-4 border-dashed border-border/20 rounded-[3rem]">
                <p className="text-sm font-bold text-muted-foreground opacity-40">{t('dashboard.scene_no_devices')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {availableDevices.map(d => {
                  const action = actions.find(a => a.deviceId === d.id);
                  const isSelected = !!action;
                  const deviceRoom = rooms.find(r => r.id === d.roomId);
                  
                  return (
                    <div key={d.id} className={cn(
                      "group relative overflow-hidden bg-muted/20 border-2 rounded-[2rem] transition-all duration-500",
                      isSelected ? "border-primary bg-primary/5 shadow-2xl scale-[1.01]" : "border-border/30 opacity-60 grayscale hover:opacity-100 hover:grayscale-0"
                    )}>
                      <div className="p-5 flex items-center justify-between gap-6" onClick={() => toggleDevice(d.id)}>
                        <div className="flex items-center gap-5 min-w-0">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-700",
                            isSelected ? "bg-primary border-primary text-primary-foreground premium-glow" : "bg-background border-border"
                          )}>
                             <PlayCircle className={cn("w-6 h-6", isSelected && "animate-pulse")} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-lg font-black tracking-tight leading-none mb-1">{humanize(d.id, d.name)}</span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-50">
                               {deviceRoom ? deviceRoom.name : t('common.unassigned')}
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <Button 
                              size="sm"
                              variant={action?.command === 'turn_on' ? "primary" : "secondary"}
                              onClick={() => setCommand(d.id, 'turn_on')}
                              className="px-6 py-3 text-[10px] font-black uppercase tracking-widest h-auto"
                            >
                              {t('common.on')}
                            </Button>
                            <Button
                              size="sm"
                              variant={action?.command === 'turn_off' ? "primary" : "secondary"}
                              onClick={() => setCommand(d.id, 'turn_off')}
                              className="px-6 py-3 text-[10px] font-black uppercase tracking-widest h-auto"
                            >
                              {t('common.off')}
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

        {/* Footer */}
        <div className="p-12 pt-6 border-t border-border/20 bg-card flex gap-6 shrink-0">
          <Button 
            variant="secondary"
            onClick={onClose} 
            className="flex-1 py-5 h-auto text-[10px]"
          >
            {t('common.cancel')}
          </Button>
          <Button 
            variant="primary"
            onClick={handleSave} 
            disabled={saving || actions.length === 0 || !name}
            className="flex-3 py-5 h-auto text-[10px]"
            isLoading={saving}
          >
            {!saving && <Save className="w-5 h-5 mr-3 inline-block" />}
            {t('scenes.builder.commit')}
          </Button>
        </div>
      </div>
    </div>
  );
};
