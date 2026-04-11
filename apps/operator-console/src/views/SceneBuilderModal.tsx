import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Save, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { API_BASE_URL } from '../config';

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
  command: 'turn_on' | 'turn_off';
}

interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
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
  const [roomId, setRoomId] = useState<string | null>(existingScene ? existingScene.roomId : initialRoomId);
  const [actions, setActions] = useState<SceneAction[]>(existingScene?.actions || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const controllableDevices = devices.filter(d => ['light', 'switch'].includes(d.type));
  // Si roomId es null, mostramos los dispositivos de forma global, si es un room especifico, solo los del room (o dejamos global siempre y pre-filtramos).
  // Hagámoslo simple: la lista de dispositivos a seleccionar depende del scope (roomId).
  const availableDevices = roomId ? controllableDevices.filter(d => d.roomId === roomId) : controllableDevices;

  const toggleDevice = (deviceId: string) => {
    const exists = actions.find(a => a.deviceId === deviceId);
    if (exists) {
      setActions(actions.filter(a => a.deviceId !== deviceId));
    } else {
      setActions([...actions, { deviceId, command: 'turn_on' }]);
    }
  };

  const setCommand = (deviceId: string, command: 'turn_on' | 'turn_off') => {
    setActions(actions.map(a => a.deviceId === deviceId ? { ...a, command } : a));
  };

  const handleSave = async () => {
    if (!name.trim()) return setError(t('dashboard.scene_name_required', { defaultValue: 'Scene name is required' }));
    if (actions.length === 0) return setError(t('dashboard.scene_actions_required', { defaultValue: 'Select at least one device' }));

    setSaving(true);
    setError(null);
    try {
      const payload = {
        homeId,
        roomId,
        name: name.trim(),
        actions
      };

      const url = existingScene 
        ? `${API_URL}/scenes/${existingScene.id}` 
        : `${API_URL}/scenes`;
      
      const method = existingScene ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Save failed');
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Error saving scene');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex justify-center items-center p-4">
      <div className="bg-card w-full max-w-lg max-h-[85vh] border border-border/50 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        
        {/* Header - Sticky by default due to flex-col */}
        <div className="flex items-center justify-between p-6 pb-4 border-b shrink-0">
          <h2 className="text-xl font-black tracking-tighter">
            {existingScene ? t('dashboard.scene_edit', { defaultValue: 'Edit Scene' }) : t('dashboard.scene_create', { defaultValue: 'Create Scene' })}
          </h2>
          <button onClick={onClose} className="p-2 bg-muted rounded-full hover:bg-muted/80 text-muted-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Scrollable area */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 custom-scrollbar">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm font-bold p-4 rounded-2xl border border-destructive/20 shrink-0">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('common.name', { defaultValue: 'Name' })}</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder={t('dashboard.scene_name_placeholder', { defaultValue: 'e.g. Movie Time' })}
              className="bg-muted p-4 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary outline-none"
            />
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('dashboard.scene_scope', { defaultValue: 'Scope' })}</label>
            <select 
              value={roomId || ''} 
              onChange={e => {
                setRoomId(e.target.value || null);
                // Si cambian de scope, limpiar acciones porque los dispositivos disponibles cambian.
                setActions([]);
              }}
              className="bg-muted p-4 rounded-2xl font-bold border-none focus:ring-2 focus:ring-primary outline-none appearance-none cursor-pointer"
            >
              <option value="">{t('dashboard.scene_global', { defaultValue: 'Global (All Rooms)' })}</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">{t('dashboard.scene_devices', { defaultValue: 'Devices & Actions' })}</label>
            
            {availableDevices.length === 0 ? (
              <div className="p-6 text-center bg-muted/50 rounded-2xl border-2 border-dashed">
                <p className="text-sm font-bold text-muted-foreground">{t('dashboard.scene_no_devices', { defaultValue: 'No controllable devices found' })}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {availableDevices.map(d => {
                  const action = actions.find(a => a.deviceId === d.id);
                  const isSelected = !!action;
                  const deviceRoom = rooms.find(r => r.id === d.roomId);
                  
                  return (
                    <div key={d.id} className={cn(
                      "flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer",
                      isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-transparent bg-muted/50 hover:bg-muted opacity-80 hover:opacity-100"
                    )} onClick={() => toggleDevice(d.id)}>
                      
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={cn("w-6 h-6 shrink-0 rounded-lg border-2 flex items-center justify-center transition-all duration-300", 
                          isSelected ? "bg-primary border-primary scale-110 shadow-lg shadow-primary/20" : "border-foreground/10")}>
                          {isSelected && <div className="w-2.5 h-2.5 rounded-sm bg-background animate-in zoom-in-50" />}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <span className="font-bold text-sm truncate">{d.name}</span>
                          <span className="text-[10px] font-bold text-foreground/40 uppercase tracking-tighter truncate">
                            {deviceRoom ? deviceRoom.name : t('common.unassigned', { defaultValue: 'Unassigned' })}
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                          <button 
                            onClick={() => setCommand(d.id, 'turn_on')}
                            className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:scale-105 active:scale-95", 
                              action?.command === 'turn_on' ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : "bg-muted text-muted-foreground hover:bg-muted-foreground/10")}
                          >
                            {t('common.on')}
                          </button>
                          <button 
                            onClick={() => setCommand(d.id, 'turn_off')}
                            className={cn("px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all hover:scale-105 active:scale-95", 
                              action?.command === 'turn_off' ? "bg-foreground text-background shadow-md shadow-black/20" : "bg-muted text-muted-foreground hover:bg-muted-foreground/10")}
                          >
                            {t('common.off')}
                          </button>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer - Fixed at bottom */}
        <div className="p-6 border-t bg-muted/30 flex gap-3 mt-auto shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="flex-1 p-4 rounded-2xl font-black uppercase tracking-wider text-xs border bg-card hover:bg-muted transition-colors"
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </button>
          <button 
            type="button" 
            onClick={handleSave} 
            disabled={saving || actions.length === 0 || !name}
            className="flex-1 p-4 rounded-2xl font-black uppercase tracking-wider text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.save', { defaultValue: 'Save' })}
          </button>
        </div>

      </div>
    </div>
  );
};
