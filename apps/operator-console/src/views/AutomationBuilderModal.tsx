import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  Zap, 
  Play, 
  ChevronRight, 
  ChevronLeft,
  AlertCircle,
  Save
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_ENDPOINTS } from '../config';
import Select from './Select';

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
        setStep('TYPE_SELECTION'); // Allow full editing from the start
      } else {
        // Reset state for new automation
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
    if (!name) {
      setError('Name is required');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    // Final payload validation
    if (triggerType === 'device_state_changed' && !triggerConfig.deviceId) {
      setError('Please select a trigger device');
      setIsSubmitting(false);
      return;
    }
    if (triggerType === 'time' && !(triggerConfig.timeLocal || triggerConfig.time)) {
      setError('Please select a trigger time');
      setIsSubmitting(false);
      return;
    }
    if (actionType === 'device_command' && !actionConfig.targetDeviceId) {
      setError('Please select an action target device');
      setIsSubmitting(false);
      return;
    }
    if (actionType === 'execute_scene' && !actionConfig.sceneId) {
      setError('Please select a scene to execute');
      setIsSubmitting(false);
      return;
    }

    const payload = {
      name,
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

      const contentType = res.headers.get('content-type');
      if (res.ok) {
        const result = await res.json();
        onCreated(result);
      } else {
        if (contentType && contentType.includes('application/json')) {
          const errData = await res.json();
          setError(errData.message || 'Failed to create automation');
        } else {
          setError(`Server error: ${res.status} (${res.statusText})`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'TYPE_SELECTION':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="space-y-2">
              <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">
                {t('automations.form.rule_name')}
              </label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('automations.form.rule_name_placeholder')}
                className="w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">
                {t('automations.form.trigger_type')}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button 
                  onClick={() => {
                    setTriggerType('device_state_changed');
                    setStep('TRIGGER_CONFIG');
                  }}
                  className="flex flex-col items-start gap-3 p-4 rounded-2xl border-2 border-foreground/5 bg-foreground/[0.02] hover:border-primary/40 hover:bg-primary/[0.02] transition-all group text-left"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">{t('automations.form.types.device_state_changed')}</span>
                    <p className="text-xs text-foreground/50 mt-0.5">IF Light turns ON</p>
                  </div>
                </button>
                <button 
                  onClick={() => {
                    setTriggerType('time');
                    setStep('TRIGGER_CONFIG');
                  }}
                  className="flex flex-col items-start gap-3 p-4 rounded-2xl border-2 border-foreground/5 bg-foreground/[0.02] hover:border-primary/40 hover:bg-primary/[0.02] transition-all group text-left"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-bold text-foreground">{t('automations.form.types.time')}</span>
                    <p className="text-xs text-foreground/50 mt-0.5">IF Time is 08:00 AM</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        );

      case 'TRIGGER_CONFIG':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {triggerType === 'device_state_changed' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.source_device')}</label>
                  <Select 
                    value={triggerConfig.deviceId || ''}
                    onChange={(val) => setTriggerConfig({ ...triggerConfig, deviceId: val })}
                    options={devices.map(d => ({ value: d.id, label: d.name }))}
                    placeholder={t('automations.form.select_device')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.state_key')}</label>
                    <Select 
                      value={triggerConfig.stateKey || 'state'}
                      onChange={(val) => setTriggerConfig({ ...triggerConfig, stateKey: val })}
                      options={[
                        { value: 'state', label: 'state (on/off)' },
                        { value: 'brightness', label: 'brightness' },
                        { value: 'temperature', label: 'temperature' }
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.expected_value')}</label>
                    <input 
                      type="text" 
                      value={triggerConfig.expectedValue || ''}
                      onChange={(e) => setTriggerConfig({ ...triggerConfig, expectedValue: e.target.value })}
                      placeholder="on / 50 / 22"
                      className="w-full bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-medium"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.time_label')}</label>
                  <div className="flex items-center gap-2">
                    <div className="p-3 bg-foreground/5 rounded-xl border border-foreground/10 h-[50px] flex items-center justify-center">
                      <Clock className="w-5 h-5 text-foreground/40" />
                    </div>
                    <Select 
                      value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0]} 
                      onChange={(h) => {
                        const m = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00';
                        setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                      }} 
                      options={HOURS} 
                      className="w-24" 
                    />
                    <span className="text-xl font-bold text-foreground/20">:</span>
                    <Select 
                      value={(triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[1] || '00'} 
                      onChange={(m) => {
                        const h = (triggerConfig.timeLocal || triggerConfig.time || '12:00').split(':')[0] || '12';
                        setTriggerConfig({ ...triggerConfig, timeLocal: `${h}:${m}` });
                      }} 
                      options={MINUTES} 
                      className="w-24" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.days_label')}</label>
                  <div className="flex flex-wrap gap-2">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => {
                      const isSelected = triggerConfig.days?.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const current = triggerConfig.days || [1,2,3,4,5];
                            const next = isSelected 
                              ? current.filter((d: number) => d !== i)
                              : [...current, i];
                            setTriggerConfig({ ...triggerConfig, days: next });
                          }}
                          className={`w-9 h-9 rounded-full font-bold text-xs transition-all border ${
                            isSelected 
                              ? 'bg-primary border-primary text-primary-foreground shadow-md shadow-primary/20' 
                              : 'bg-card border-foreground/10 text-foreground/40 hover:border-primary/40 hover:text-primary'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-foreground/30 font-medium tracking-tight mt-2 italic px-1">
                    Rule will fire at precisely HH:mm during selected days.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
              <button 
                onClick={() => setStep('TYPE_SELECTION')}
                className="flex items-center gap-2 text-foreground/40 hover:text-foreground font-bold text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button 
                disabled={(!triggerConfig.deviceId && triggerType === 'device_state_changed') || (!(triggerConfig.timeLocal || triggerConfig.time) && triggerType === 'time')}
                onClick={() => setStep('ACTION_SELECTION')}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'ACTION_SELECTION':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">
              {t('automations.form.action_type')}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button 
                onClick={() => {
                  setActionType('device_command');
                  setStep('ACTION_CONFIG');
                }}
                className="flex flex-col items-start gap-3 p-4 rounded-2xl border-2 border-foreground/5 bg-foreground/[0.02] hover:border-accent/40 hover:bg-accent/[0.02] transition-all group text-left"
              >
                <div className="p-2 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-foreground">{t('automations.form.types.device_command')}</span>
                  <p className="text-xs text-foreground/50 mt-0.5">THEN Turn ON Lamp</p>
                </div>
              </button>
              <button 
                onClick={() => {
                  setActionType('execute_scene');
                  setStep('ACTION_CONFIG');
                }}
                className="flex flex-col items-start gap-3 p-4 rounded-2xl border-2 border-foreground/5 bg-foreground/[0.02] hover:border-purple-500/40 hover:bg-purple-500/[0.02] transition-all group text-left"
              >
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-foreground">{t('automations.form.types.execute_scene')}</span>
                  <p className="text-xs text-foreground/50 mt-0.5">THEN RUN "Movie Scene"</p>
                </div>
              </button>
            </div>
            <div className="flex justify-start pt-4 border-t border-foreground/5">
              <button 
                onClick={() => setStep('TRIGGER_CONFIG')}
                className="flex items-center gap-2 text-foreground/40 hover:text-foreground font-bold text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            </div>
          </div>
        );

      case 'ACTION_CONFIG':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            {actionType === 'device_command' ? (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.target_device')}</label>
                  <Select 
                    value={actionConfig.targetDeviceId || ''}
                    onChange={(val) => setActionConfig({ ...actionConfig, targetDeviceId: val })}
                    options={devices.map(d => ({ value: d.id, label: d.name }))}
                    placeholder={t('automations.form.select_target')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.command')}</label>
                  <Select 
                    value={actionConfig.command || 'turn_on'}
                    onChange={(val) => setActionConfig({ ...actionConfig, command: val })}
                    options={[
                      { value: 'turn_on', label: 'TURN ON' },
                      { value: 'turn_off', label: 'TURN OFF' },
                      { value: 'toggle', label: 'TOGGLE' }
                    ]}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground/50 uppercase tracking-wider">{t('automations.form.select_scene')}</label>
                <Select 
                  value={actionConfig.sceneId || ''}
                  onChange={(val) => setActionConfig({ ...actionConfig, sceneId: val })}
                  options={scenes.map(s => ({ value: s.id, label: s.name }))}
                  placeholder={t('automations.form.select_scene')}
                />
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
              <button 
                onClick={() => setStep('ACTION_SELECTION')}
                className="flex items-center gap-2 text-foreground/40 hover:text-foreground font-bold text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button 
                disabled={!actionConfig.targetDeviceId && actionType === 'device_command' || !actionConfig.sceneId && actionType === 'execute_scene'}
                onClick={() => setStep('FINAL')}
                className="flex items-center gap-2 px-6 py-2.5 bg-foreground text-background rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30"
              >
                Review
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        );

      case 'FINAL':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10">
              <h4 className="font-bold text-foreground mb-4">Summary</h4>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-1 bg-primary rounded-full opacity-30" />
                  <div>
                    <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">When (Trigger)</span>
                    <p className="text-sm font-medium text-foreground">
                      {triggerType === 'time' 
                        ? `At ${triggerConfig.timeLocal || triggerConfig.time}` 
                        : `Device ${devices.find(d => d.id === triggerConfig.deviceId)?.name} is ${triggerConfig.expectedValue}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-1 bg-accent rounded-full opacity-30" />
                  <div>
                    <span className="text-[10px] font-bold text-accent uppercase tracking-widest block mb-1">Then (Action)</span>
                    <p className="text-sm font-medium text-foreground">
                      {actionType === 'device_command' 
                        ? `${(actionConfig.command || 'turn_on').replace('_', ' ').toUpperCase()} for ${devices.find(d => d.id === actionConfig.targetDeviceId)?.name || '...'}`
                        : `Run scene "${scenes.find(s => s.id === actionConfig.sceneId)?.name || '...'}"`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-sm animate-shake">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="font-medium">{error}</p>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-foreground/5">
              <button 
                onClick={() => setStep('ACTION_CONFIG')}
                className="flex items-center gap-2 text-foreground/40 hover:text-foreground font-bold text-sm"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              <button 
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold transition-all hover:scale-[1.05] active:scale-95 shadow-xl shadow-primary/20 disabled:opacity-50"
              >
                {isSubmitting ? (existingAutomation ? 'Saving...' : 'Creating...') : (existingAutomation ? 'Update Automation' : 'Save Automation')}
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-lg bg-card border border-foreground/10 rounded-[2.5rem] shadow-2xl shadow-black/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
        {/* Header */}
        <div className="p-8 pb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-foreground">
              {existingAutomation ? t('automations.edit_rule') : t('automations.create_rule')}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {[1, 2, 3, 4, 5].map((s) => {
                const stepIndex = ['TYPE_SELECTION', 'TRIGGER_CONFIG', 'ACTION_SELECTION', 'ACTION_CONFIG', 'FINAL'].indexOf(step) + 1;
                return (
                  <div 
                    key={s} 
                    className={`h-1 rounded-full transition-all duration-500 ${
                      s <= stepIndex ? 'w-4 bg-primary' : 'w-2 bg-foreground/10'
                    }`}
                  />
                );
              })}
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-foreground/5 transition-colors"
          >
            <X className="w-6 h-6 text-foreground/30" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-4 pb-12 max-h-[70vh] overflow-y-auto custom-scrollbar">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default AutomationBuilderModal;
