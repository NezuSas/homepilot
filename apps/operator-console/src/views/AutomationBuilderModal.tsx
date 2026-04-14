import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, Clock, Zap, Play, ChevronLeft,
  AlertCircle, Save, CheckCircle2, ArrowRight, Loader2
} from 'lucide-react';
import { API_ENDPOINTS } from '../config';
import Select from './Select';
import { humanize } from '../lib/naming-utils';
import { cn } from '../lib/utils';
import { mapDeviceCommand } from '../lib/i18n-mapping-utils';

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

type Step = 'TYPE_SELECTION' | 'TRIGGER_CONFIG' | 'ACTION_SELECTION' | 'ACTION_CONFIG' | 'FINAL';

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
  const [step, setStep] = useState<Step>('TYPE_SELECTION');
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
        setStep('TYPE_SELECTION');
      } else {
        setName('');
        setTriggerType('device_state_changed');
        setTriggerConfig({ deviceId: '', stateKey: 'state', expectedValue: 'on' });
        setActionType('device_command');
        setActionConfig({ targetDeviceId: '', command: 'turn_on' });
        setStep('TYPE_SELECTION');
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
      
      const res = await fetch(url, {
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

  const getDeviceName = (id?: string) => {
    const d = devices.find(dev => dev.id === id);
    return d ? humanize(d.id, d.name) : (id || t('common.unassigned'));
  };

  const renderStep = () => {
    switch (step) {
      case 'TYPE_SELECTION':
        return (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.builder.naming_label')}</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('automations.builder.placeholders.name')}
                className="w-full bg-muted/20 border-2 border-border/40 rounded-[1.5rem] px-6 py-5 text-2xl font-black tracking-tighter focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20"
                autoFocus
              />
            </div>

            <div className="space-y-6">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.builder.trigger_label')}</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => { setTriggerType('device_state_changed'); setStep('TRIGGER_CONFIG'); }}
                  className={cn(
                    "flex flex-col items-start gap-4 p-6 rounded-[2rem] border-2 transition-all group text-left",
                    triggerType === 'device_state_changed' ? "border-primary bg-primary/5 premium-glow" : "border-border/40 bg-muted/20 hover:border-border"
                  )}
                >
                  <div className={cn("p-4 rounded-2xl transition-all", triggerType === 'device_state_changed' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary")}>
                    <Zap className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-black text-lg tracking-tighter">{t('automations.form.types.device_state_changed')}</span>
                    <p className="text-xs font-bold text-muted-foreground opacity-60 mt-1">{t('automations.builder.trigger_device_hint')}</p>
                  </div>
                </button>
                <button 
                  onClick={() => { setTriggerType('time'); setStep('TRIGGER_CONFIG'); }}
                  className={cn(
                    "flex flex-col items-start gap-4 p-6 rounded-[2rem] border-2 transition-all group text-left",
                    triggerType === 'time' ? "border-primary bg-primary/5 premium-glow" : "border-border/40 bg-muted/20 hover:border-border"
                  )}
                >
                  <div className={cn("p-4 rounded-2xl transition-all", triggerType === 'time' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary")}>
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-black text-lg tracking-tighter">{t('automations.form.types.time')}</span>
                    <p className="text-xs font-bold text-muted-foreground opacity-60 mt-1">{t('automations.builder.trigger_time_hint')}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 'TRIGGER_CONFIG':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {triggerType === 'device_state_changed' ? (
              <>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.source_device')}</label>
                  <Select 
                    value={triggerConfig.deviceId || ''}
                    onChange={(val) => setTriggerConfig({ ...triggerConfig, deviceId: val })}
                    options={devices.map(d => ({ value: d.id, label: humanize(d.id, d.name) }))}
                    placeholder={t('automations.form.select_device')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.state_key')}</label>
                    <Select 
                      value={triggerConfig.stateKey || 'state'}
                      onChange={(val) => setTriggerConfig({ ...triggerConfig, stateKey: val })}
                      options={[{ value: 'state', label: t('automations.builder.properties.state') }, { value: 'brightness', label: t('automations.builder.properties.lux') }, { value: 'temperature', label: t('automations.builder.properties.temp') }]}
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.expected_value')}</label>
                    <input 
                      type="text" 
                      value={triggerConfig.expectedValue || ''}
                      onChange={(e) => setTriggerConfig({ ...triggerConfig, expectedValue: e.target.value })}
                      placeholder={t('automations.builder.placeholders.expected_value')}
                      className="w-full bg-muted/20 border-2 border-border/40 rounded-[1.2rem] px-5 py-3.5 text-lg font-black tracking-tight focus:border-primary/50 focus:ring-0 transition-all"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.time_label')}</label>
                  <div className="flex items-center gap-4">
                    <Select 
                      value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0]} 
                      onChange={(h) => {
                        const m = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00';
                        setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                      }} 
                      options={HOURS} 
                      className="w-28 text-center" 
                    />
                    <span className="text-2xl font-black opacity-20">:</span>
                    <Select 
                      value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00'} 
                      onChange={(m) => {
                        const h = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0] || '12';
                        setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                      }} 
                      options={MINUTES} 
                      className="w-28 text-center" 
                    />
                  </div>
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.days_label')}</label>
                  <div className="flex flex-wrap gap-3">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                      const isSelected = (triggerConfig.days || []).includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const current = triggerConfig.days || [1,2,3,4,5];
                            const next = isSelected ? current.filter((d: number) => d !== i) : [...current, i];
                            setTriggerConfig({ ...triggerConfig, days: next });
                          }}
                          className={cn(
                            "w-12 h-12 rounded-2xl font-black text-xs transition-all border-2",
                            isSelected ? "bg-primary border-primary text-primary-foreground premium-glow" : "bg-muted/20 border-border/40 text-muted-foreground hover:border-border"
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

            <div className="flex justify-between items-center pt-8">
              <button onClick={() => setStep('TYPE_SELECTION')} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> {t('common.back')}
              </button>
              <button 
                disabled={(!triggerConfig.deviceId && triggerType === 'device_state_changed') || (!(triggerConfig.timeLocal || triggerConfig.time) && triggerType === 'time')}
                onClick={() => setStep('ACTION_SELECTION')}
                className="bg-foreground text-background px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-20"
              >
                {t('common.continue')}
              </button>
            </div>
          </div>
        );

      case 'ACTION_SELECTION':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.builder.action_label')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={() => { setActionType('device_command'); setStep('ACTION_CONFIG'); }}
                className={cn(
                  "flex flex-col items-start gap-4 p-6 rounded-[2rem] border-2 transition-all group text-left",
                  actionType === 'device_command' ? "border-primary bg-primary/5 premium-glow" : "border-border/40 bg-muted/20 hover:border-border"
                )}
              >
                <div className={cn("p-4 rounded-2xl transition-all", actionType === 'device_command' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary")}>
                  <Save className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-black text-lg tracking-tighter">{t('automations.builder.actions.direct_command')}</span>
                  <p className="text-xs font-bold text-muted-foreground opacity-60 mt-1">{t('automations.builder.actions.direct_command_desc')}</p>
                </div>
              </button>
              <button 
                onClick={() => { setActionType('execute_scene'); setStep('ACTION_CONFIG'); }}
                className={cn(
                  "flex flex-col items-start gap-4 p-6 rounded-[2rem] border-2 transition-all group text-left",
                  actionType === 'execute_scene' ? "border-primary bg-primary/5 premium-glow" : "border-border/40 bg-muted/20 hover:border-border"
                )}
              >
                <div className={cn("p-4 rounded-2xl transition-all", actionType === 'execute_scene' ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary")}>
                  <Play className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-black text-lg tracking-tighter">{t('automations.builder.actions.invoke_scene')}</span>
                  <p className="text-xs font-bold text-muted-foreground opacity-60 mt-1">{t('automations.builder.actions.invoke_scene_desc')}</p>
                </div>
              </button>
            </div>
            <button onClick={() => setStep('TRIGGER_CONFIG')} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
              <ChevronLeft className="w-4 h-4" /> {t('common.back')}
            </button>
          </div>
        );

      case 'ACTION_CONFIG':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {actionType === 'device_command' ? (
              <>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.target_device')}</label>
                  <Select 
                    value={actionConfig.targetDeviceId || ''}
                    onChange={(val) => setActionConfig({ ...actionConfig, targetDeviceId: val })}
                    options={devices.map(d => ({ value: d.id, label: humanize(d.id, d.name) }))}
                    placeholder={t('automations.form.select_device')}
                  />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.action_type')}</label>
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
              </>
            ) : (
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-50">{t('automations.form.select_scene')}</label>
                <Select 
                  value={actionConfig.sceneId || ''}
                  onChange={(val) => setActionConfig({ ...actionConfig, sceneId: val })}
                  options={scenes.map(s => ({ value: s.id, label: s.name }))}
                  placeholder={t('automations.form.select_scene')}
                />
              </div>
            )}

            <div className="flex justify-between items-center pt-8">
              <button onClick={() => setStep('ACTION_SELECTION')} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> {t('common.back')}
              </button>
              <button 
                disabled={!actionConfig.targetDeviceId && actionType === 'device_command' || !actionConfig.sceneId && actionType === 'execute_scene'}
                onClick={() => setStep('FINAL')}
                className="bg-foreground text-background px-8 py-4 rounded-3xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-20"
              >
                {t('automations.builder.review')}
              </button>
            </div>
          </div>
        );

      case 'FINAL':
        const triggerDesc = triggerType === 'time' ? t('automations.summary.at_time', { time: triggerConfig.timeLocal || triggerConfig.time }) : t('automations.summary.when_device', { name: getDeviceName(triggerConfig.deviceId), value: triggerConfig.expectedValue });
        const actionDesc = actionType === 'device_command' ? t('automations.summary.run_command', { command: mapDeviceCommand(actionConfig.command || 'turn_on', t), name: getDeviceName(actionConfig.targetDeviceId) }) : t('automations.summary.run_scene', { name: scenes.find(s => s.id === actionConfig.sceneId)?.name });

        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-600">
            <div className="p-8 rounded-[3rem] bg-muted/20 border-2 border-border/40 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-5">
                  <CheckCircle2 className="w-32 h-32" />
               </div>
               <div className="relative space-y-8">
                  <div className="flex items-start gap-5">
                    <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0">
                       <span className="text-[10px] font-black">IF</span>
                    </div>
                    <p className="text-xl font-black tracking-tight pt-1">{triggerDesc}</p>
                  </div>
                  <div className="ml-5 pl-5 border-l-2 border-dashed border-border/40">
                     <ArrowRight className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex items-start gap-5">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                       <span className="text-[10px] font-black">THEN</span>
                    </div>
                    <p className="text-xl font-black tracking-tight pt-1">{actionDesc}</p>
                  </div>
               </div>
            </div>

            {error && (
              <div className="p-5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-wider">{error}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-8">
              <button onClick={() => setStep('ACTION_CONFIG')} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground flex items-center gap-2">
                <ChevronLeft className="w-4 h-4" /> {t('common.back')}
              </button>
              <button 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="bg-primary text-primary-foreground px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all hover:scale-110 active:scale-95 premium-glow shadow-primary/20 flex items-center gap-4"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {t('automations.builder.commit')}
              </button>
            </div>
          </div>
        );
    }
  };

  const stepIndex = ['TYPE_SELECTION', 'TRIGGER_CONFIG', 'ACTION_SELECTION', 'ACTION_CONFIG', 'FINAL'].indexOf(step);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/60 backdrop-blur-3xl transition-opacity animate-in fade-in duration-500" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-card/60 backdrop-blur-2xl border-2 border-border/40 rounded-[4rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
        <div className="p-12 pb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black tracking-tighter">
              {existingAutomation ? t('automations.builder.title_edit') : t('automations.builder.title_create')}
            </h2>
            <div className="flex items-center gap-1.5 mt-3">
              {[0, 1, 2, 3, 4].map((s) => (
                <div key={s} className={cn("h-1 rounded-full transition-all duration-700", s <= stepIndex ? "w-6 bg-primary" : "w-3 bg-muted")} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-4 bg-muted/40 hover:bg-muted rounded-2xl transition-all">
            <X className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
        <div className="p-12 pt-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default AutomationBuilderModal;
