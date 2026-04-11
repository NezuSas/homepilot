import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Clock, 
  Zap, 
  Settings2,
  AlertCircle,
  ToggleLeft as ToggleIcon
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AutomationBuilderModal from './AutomationBuilderModal.tsx';

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    type: 'device_state_changed' | 'time';
    deviceId?: string;
    stateKey?: string;
    expectedValue?: any;
    time?: string;
    days?: number[];
  };
  action: {
    type: 'device_command' | 'execute_scene';
    targetDeviceId?: string;
    command?: string;
    sceneId?: string;
  };
}

interface Device {
  id: string;
  name: string;
}

interface Scene {
  id: string;
  name: string;
}

const AutomationsView: React.FC = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [rulesRes, devicesRes, scenesRes] = await Promise.all([
        fetch('/api/v1/automations'),
        fetch('/api/v1/devices'),
        fetch('/api/v1/scenes')
      ]);

      if (!rulesRes.ok || !devicesRes.ok || !scenesRes.ok) throw new Error('Failed to fetch data');

      const [rulesData, devicesData, scenesData] = await Promise.all([
        rulesRes.json(),
        devicesRes.json(),
        scenesRes.json()
      ]);

      setRules(rulesData);
      setDevices(devicesData);
      setScenes(scenesData);
      setError(null);
    } catch (err) {
      setError('Connection error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleRule = async (id: string, currentlyEnabled: boolean) => {
    const action = currentlyEnabled ? 'disable' : 'enable';
    try {
      const res = await fetch(`/api/v1/automations/${id}/${action}`, { method: 'PATCH' });
      if (res.ok) {
        setRules(rules.map(r => r.id === id ? { ...r, enabled: !currentlyEnabled } : r));
      }
    } catch (err) {
      console.error('Failed to toggle rule', err);
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm(t('common.confirm'))) return;
    try {
      const res = await fetch(`/api/v1/automations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(rules.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete rule', err);
    }
  };

  const getDeviceName = (id?: string) => devices.find(d => d.id === id)?.name || id || 'Unknown Device';
  const getSceneName = (id?: string) => scenes.find(s => s.id === id)?.name || id || 'Unknown Scene';

  const renderSummary = (rule: AutomationRule) => {
    const { trigger, action } = rule;
    let triggerText = '';
    let actionText = '';

    if (trigger.type === 'time') {
      triggerText = t('automations.summary.at_time', { time: trigger.time });
    } else {
      triggerText = t('automations.summary.when_device', { 
        name: getDeviceName(trigger.deviceId), 
        value: trigger.expectedValue 
      });
    }

    if (action.type === 'device_command') {
      actionText = t('automations.summary.run_command', { 
        command: action.command?.toUpperCase(), 
        name: getDeviceName(action.targetDeviceId) 
      });
    } else {
      actionText = t('automations.summary.run_scene', { 
        name: getSceneName(action.sceneId) 
      });
    }

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
            {t('automations.form.trigger_section').split(' ')[0]}
          </span>
          <span className="font-medium text-foreground">{triggerText}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-foreground/70">
          <span className="px-1.5 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-wider">
            {t('automations.form.action_section').split(' ')[0]}
          </span>
          <span className="font-medium text-foreground">{actionText}</span>
        </div>
      </div>
    );
  };

  if (isLoading && rules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-foreground/50">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">{t('automations.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-primary" />
            {t('automations.title')}
          </h1>
          <p className="text-foreground/60 mt-1">
            {t('automations.active_recipes', { count: rules.filter(r => r.enabled).length })}
          </p>
        </div>
        <button 
          onClick={() => setIsBuilderOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-primary/20"
        >
          <Plus className="w-5 h-5" />
          {t('automations.create_rule')}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500 text-sm animate-shake">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 py-24 rounded-3xl border-2 border-dashed border-foreground/10 bg-foreground/5">
          <div className="w-20 h-20 rounded-full bg-foreground/5 flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-foreground/20" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">
            {t('automations.empty_state.title')}
          </h3>
          <p className="text-foreground/50 text-center max-w-sm mb-8">
            {t('automations.empty_state.description')}
          </p>
          <button 
            onClick={() => setIsBuilderOpen(true)}
            className="text-primary font-bold hover:underline underline-offset-4"
          >
            {t('automations.create_rule')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rules.map((rule) => (
            <div 
              key={rule.id}
              className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
                rule.enabled 
                  ? 'bg-card border-foreground/10 shadow-sm' 
                  : 'bg-foreground/[0.02] border-foreground/5 grayscale-[0.5] opacity-80'
              }`}
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl transition-colors ${
                      rule.enabled ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-foreground/40'
                    }`}>
                      {rule.trigger.type === 'time' ? <Clock className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                        {rule.name}
                      </h4>
                      <p className="text-[10px] font-bold text-foreground/40 uppercase tracking-widest mt-0.5">
                        {rule.trigger.type === 'time' ? t('automations.form.types.time') : t('automations.form.types.device_state_changed')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => toggleRule(rule.id, rule.enabled)}
                      className={`p-2 rounded-lg transition-all ${
                        rule.enabled ? 'text-primary hover:bg-primary/10' : 'text-foreground/30 hover:bg-foreground/10'
                      }`}
                      title={rule.enabled ? t('common.disable') : t('common.enable')}
                    >
                      <ToggleIcon className={`w-6 h-6 transition-transform ${rule.enabled ? '' : 'rotate-180 opacity-50'}`} />
                    </button>
                    <button 
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 text-foreground/30 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="flex-1">
                  {renderSummary(rule)}
                </div>

                <div className="mt-4 pt-4 border-t border-foreground/[0.05] flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className={`w-2 h-2 rounded-full ${rule.enabled ? 'bg-green-500 animate-pulse' : 'bg-foreground/20'}`} />
                     <span className="text-[10px] font-bold uppercase tracking-tight text-foreground/40">
                       {rule.enabled ? 'System Monitoring' : 'Inactive'}
                     </span>
                   </div>
                   <div className="flex items-center gap-1 text-[10px] font-bold text-foreground/30">
                     <span className="uppercase">V1 Edge Logic</span>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isBuilderOpen && (
        <AutomationBuilderModal 
          isOpen={isBuilderOpen}
          onClose={() => setIsBuilderOpen(false)}
          onCreated={() => {
            setIsBuilderOpen(false);
            fetchData();
          }}
          devices={devices}
          scenes={scenes}
        />
      )}
    </div>
  );
};

export default AutomationsView;
