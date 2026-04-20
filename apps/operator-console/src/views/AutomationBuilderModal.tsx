import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Clock, Zap, Play, 
  AlertCircle, Save, ArrowRight, Loader2
} from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import { apiFetch } from '../lib/apiClient';
import Select from './Select';
import { humanize } from '../lib/naming-utils';
import { cn } from '../lib/utils';

interface Device {
  id: string;
  name: string;
}

interface Scene {
  id: string;
  name: string;
}

interface AutomationBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (rule: any) => void;
  devices: Device[];
  scenes: Scene[];
  existingAutomation?: any;
}

const HOURS = Array.from({ length: 24 }, (_, i) => ({ 
  value: i.toString().padStart(2, '0'), 
  label: i.toString().padStart(2, '0') 
}));

const MINUTES = Array.from({ length: 60 }, (_, i) => ({ 
  value: i.toString().padStart(2, '0'), 
  label: i.toString().padStart(2, '0') 
}));

const AutomationBuilderModal: React.FC<AutomationBuilderModalProps> = ({ 
  isOpen, 
  onClose, 
  onCreated,
  devices,
  scenes,
  existingAutomation
}) => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'device_state_changed' | 'time'>('device_state_changed');
  const [triggerConfig, setTriggerConfig] = useState<any>({
    deviceId: '',
    stateKey: 'state',
    expectedValue: 'on'
  });
  const [actionType, setActionType] = useState<'device_command' | 'execute_scene'>('device_command');
  const [actionConfig, setActionConfig] = useState<any>({
    targetDeviceId: '',
    command: 'turn_on'
  });

  useEffect(() => {
    if (isOpen) {
      if (existingAutomation) {
        setName(existingAutomation.name);
        setTriggerType(existingAutomation.trigger.type);
        setTriggerConfig({ ...existingAutomation.trigger });
        setActionType(existingAutomation.action.type);
        setActionConfig({ ...existingAutomation.action });
      } else {
        setName('');
        setTriggerType('device_state_changed');
        setTriggerConfig({ deviceId: '', stateKey: 'state', expectedValue: 'on' });
        setActionType('device_command');
        setActionConfig({ targetDeviceId: '', command: 'turn_on' });
      }
      setError(null);
    }
  }, [isOpen, existingAutomation]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!name.trim()) { setError(t('automations.builder.errors.no_name')); return; }
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name: name.trim(),
      trigger: {
        type: triggerType,
        ...triggerConfig,
        ...(triggerType === 'time' ? {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timeLocal: triggerConfig.timeLocal || triggerConfig.time
        } : {})
      },
      action: {
        type: actionType,
        ...actionConfig
      }
    };

    try {
      const url = existingAutomation 
        ? `${API_ENDPOINTS.automations.list}/${existingAutomation.id}`
        : API_ENDPOINTS.automations.list;
      
      const res = await apiFetch(url, {
        method: existingAutomation ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const result = await res.json();
        onCreated(result);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || `Server error: ${res.status}`);
      }
    } catch (err: any) {
      setError(err.message || t('common.errors.connection_error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card/60 backdrop-blur-2xl border-2 border-border/40 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header - Condensed */}
        <div className="px-8 pt-8 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tighter">
              {existingAutomation ? t('automations.builder.title_edit') : t('automations.builder.title_create')}
            </h2>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 mt-1">
              {t('automations.builder.cockpit_subtitle')}
            </p>
          </div>
          <button onClick={onClose} className="p-3 bg-muted/40 hover:bg-muted rounded-xl transition-all">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-8 pt-2 max-h-[82vh] overflow-y-auto custom-scrollbar space-y-6">
          {/* Identity Section */}
          <div className="space-y-3">
            <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50 ml-1">{t('automations.builder.naming_label')}</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('automations.builder.placeholders.name')}
              className="w-full bg-muted/20 border-2 border-border/10 rounded-[1.2rem] px-5 py-4 text-xl font-black tracking-tighter focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* IF SECTION (Trigger) */}
            <div className="space-y-4 p-6 rounded-[2rem] bg-muted/10 border border-border/10 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 px-3 rounded-full bg-background border flex items-center justify-center shrink-0 min-w-8">
                  <span className="text-[9px] font-black">{t('automations.summary.if')}</span>
                </div>
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">{t('automations.builder.trigger_subtitle')}</label>
              </div>

              {/* Trigger Type Switcher */}
              <div className="flex bg-background/50 p-1.5 rounded-2xl gap-1 border border-border/10">
                <button 
                  onClick={() => setTriggerType('device_state_changed')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    triggerType === 'device_state_changed' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-foreground/5"
                  )}
                >
                  <Zap className="w-3 h-3" /> {t('automations.builder.properties.state')}
                </button>
                <button 
                  onClick={() => setTriggerType('time')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    triggerType === 'time' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-foreground/5"
                  )}
                >
                  <Clock className="w-3 h-3" /> {t('common.time', { defaultValue: 'Time' })}
                </button>
              </div>

              {triggerType === 'device_state_changed' ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.source_device')}</label>
                    <Select 
                      searchable
                      value={triggerConfig.deviceId || ''}
                      onChange={(val) => setTriggerConfig({ ...triggerConfig, deviceId: val })}
                      options={devices.map(d => ({ value: d.id, label: humanize(d.id, d.name) }))}
                      placeholder={t('automations.form.select_device')}
                    />
                  </div>
                  <div className="grid grid-cols-5 gap-3">
                    <div className="space-y-2 col-span-3">
                      <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.state_key')}</label>
                      <Select 
                        value={triggerConfig.stateKey || 'state'}
                        onChange={(val) => setTriggerConfig({ ...triggerConfig, stateKey: val })}
                        options={[{ value: 'state', label: t('automations.builder.properties.state') }, { value: 'brightness', label: t('automations.builder.properties.lux') }, { value: 'temperature', label: t('automations.builder.properties.temp') }]}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.expected_value')}</label>
                      <input 
                        type="text" 
                        value={triggerConfig.expectedValue || ''}
                        onChange={(e) => setTriggerConfig({ ...triggerConfig, expectedValue: e.target.value })}
                        placeholder={t('automations.builder.placeholders.expected_value')}
                        className="w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-2.5 text-sm font-bold tracking-tight focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20 translate-y-[1px]"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.time_label')}</label>
                    <div className="flex items-center gap-2">
                      <Select 
                        value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0]} 
                        onChange={(h) => {
                          const m = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00';
                          setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                        }} 
                        options={HOURS} 
                        className="flex-1 text-center" 
                      />
                      <span className="text-lg font-black opacity-10">:</span>
                      <Select 
                        value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00'} 
                        onChange={(m) => {
                          const h = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0] || '12';
                          setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                        }} 
                        options={MINUTES} 
                        className="flex-1 text-center" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.days_label')}</label>
                    <div className="flex flex-wrap gap-1.5 justify-between">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                        const isSelected = (triggerConfig.days || [0,1,2,3,4,5,6]).includes(i);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const current = triggerConfig.days || [0,1,2,3,4,5,6];
                              const next = isSelected ? current.filter((d: number) => d !== i) : [...current, i];
                              setTriggerConfig({ ...triggerConfig, days: next });
                            }}
                            className={cn(
                              "w-8 h-8 rounded-lg font-black text-[9px] transition-all border-2",
                              isSelected ? "bg-primary border-primary text-primary-foreground premium-glow" : "bg-muted/20 border-border/10 text-muted-foreground opacity-40 hover:opacity-100"
                            )}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* THEN SECTION (Action) */}
            <div className="space-y-4 p-6 rounded-[2rem] bg-primary/[0.02] border border-primary/10 relative overflow-hidden">
               <div className="flex items-center gap-3 mb-2">
                <div className="h-8 px-3 rounded-full bg-primary text-primary-foreground border-none flex items-center justify-center shrink-0 min-w-8">
                  <span className="text-[9px] font-black">{t('automations.summary.then')}</span>
                </div>
                <label className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">{t('automations.builder.action_subtitle')}</label>
              </div>

              {/* Action Type Switcher */}
              <div className="flex bg-primary/[0.05] p-1.5 rounded-2xl gap-1 border border-primary/10">
                <button 
                  onClick={() => setActionType('device_command')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    actionType === 'device_command' ? "bg-primary text-primary-foreground shadow-lg" : "text-primary/40 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <Play className="w-3 h-3 rotate-90" /> {t('automations.builder.actions.direct_command')}
                </button>
                <button 
                  onClick={() => setActionType('execute_scene')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                    actionType === 'execute_scene' ? "bg-primary text-primary-foreground shadow-lg" : "text-primary/40 hover:bg-primary/10 hover:text-primary"
                  )}
                >
                  <ArrowRight className="w-3 h-3" /> {t('nav.scenes')}
                </button>
              </div>

              {actionType === 'device_command' ? (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-primary/50 ml-1">{t('automations.form.target_device')}</label>
                    <Select 
                      searchable
                      value={actionConfig.targetDeviceId || ''}
                      onChange={(val) => setActionConfig({ ...actionConfig, targetDeviceId: val })}
                      options={devices.map(d => ({ value: d.id, label: humanize(d.id, d.name) }))}
                      placeholder={t('automations.form.select_device')}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-primary/50 ml-1">{t('automations.form.action_type')}</label>
                    <Select 
                      value={actionConfig.command || 'turn_on'}
                      onChange={(val) => setActionConfig({ ...actionConfig, command: val })}
                      options={[
                        { value: 'turn_on', label: t('automations.builder.commands.turn_on') },
                        { value: 'turn_off', label: t('automations.builder.commands.turn_off') },
                        { value: 'toggle', label: t('automations.builder.commands.toggle') }
                      ]}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase tracking-widest text-primary/50 ml-1">{t('automations.form.select_scene')}</label>
                    <Select 
                      searchable
                      value={actionConfig.sceneId || ''}
                      onChange={(val) => setActionConfig({ ...actionConfig, sceneId: val })}
                      options={scenes.map(s => ({ value: s.id, label: s.name }))}
                      placeholder={t('automations.form.select_scene')}
                    />
                  </div>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex items-center gap-3">
                     <AlertCircle className="w-4 h-4 text-primary opacity-40 shrink-0" />
                     <p className="text-[10px] font-medium leading-tight text-primary/60">{t('automations.builder.scene_info')}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-wider leading-none">{error}</p>
            </div>
          )}

          {/* Footer - Integrated Action Button */}
          <div className="pt-2">
            <button 
              disabled={isSubmitting || !name || (triggerType === 'device_state_changed' && !triggerConfig.deviceId) || (actionType === 'device_command' && !actionConfig.targetDeviceId) || (actionType === 'execute_scene' && !actionConfig.sceneId)}
              onClick={handleSubmit}
              className="w-full bg-primary text-primary-foreground py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] transition-all hover:scale-[1.02] active:scale-95 premium-glow shadow-primary/20 flex items-center justify-center gap-4 disabled:opacity-30 disabled:hover:scale-100"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {t('automations.builder.commit')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationBuilderModal;
