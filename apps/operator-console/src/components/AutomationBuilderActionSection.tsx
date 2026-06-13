import React from 'react';
import { AlertCircle, ArrowRight, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Select from '../views/Select';
import { SegmentedControl } from './ui/SegmentedControl';
import { humanize } from '../lib/naming-utils';
import type { AutomationActionConfig, AutomationBuilderDevice, AutomationBuilderScene } from './AutomationBuilderTypes';

interface AutomationBuilderActionSectionProps {
  devices: AutomationBuilderDevice[];
  scenes: AutomationBuilderScene[];
  actionType: 'device_command' | 'execute_scene';
  actionConfig: AutomationActionConfig;
  onActionTypeChange: (actionType: 'device_command' | 'execute_scene') => void;
  onActionConfigChange: (actionConfig: AutomationActionConfig) => void;
}

export const AutomationBuilderActionSection: React.FC<AutomationBuilderActionSectionProps> = ({
  devices,
  scenes,
  actionType,
  actionConfig,
  onActionTypeChange,
  onActionConfigChange
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 p-6 rounded-[2rem] bg-primary/[0.02] border border-primary/10 relative">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 px-3 rounded-full bg-primary text-primary-foreground border-none flex items-center justify-center shrink-0 min-w-8">
          <span className="text-[9px] font-black">{t('automations.summary.then')}</span>
        </div>
        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-primary/60">{t('automations.builder.action_subtitle')}</label>
      </div>

      <SegmentedControl
        value={actionType}
        tone="primary"
        onChange={onActionTypeChange}
        options={[
          { value: 'device_command', label: t('automations.builder.actions.direct_command'), icon: Terminal },
          { value: 'execute_scene', label: t('nav.scenes'), icon: ArrowRight },
        ]}
      />

      {actionType === 'device_command' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-2">
            <label className="text-[8px] font-black uppercase tracking-widest text-primary/50 ml-1">{t('automations.form.target_device')}</label>
            <Select
              searchable
              value={actionConfig.targetDeviceId || ''}
              onChange={(value: string) => onActionConfigChange({ ...actionConfig, targetDeviceId: value })}
              options={devices.map(device => ({ value: device.id, label: humanize(device.id, device.name) }))}
              placeholder={t('automations.form.select_device')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[8px] font-black uppercase tracking-widest text-primary/50 ml-1">{t('automations.form.action_type')}</label>
            <Select
              value={actionConfig.command || 'turn_on'}
              onChange={(value: string) => onActionConfigChange({ ...actionConfig, command: value })}
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
              onChange={(value: string) => onActionConfigChange({ ...actionConfig, sceneId: value })}
              options={scenes.map(scene => ({ value: scene.id, label: scene.name }))}
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
  );
};
