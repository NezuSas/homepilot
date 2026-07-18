import React from 'react';
import { AlertCircle, ArrowRight, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SegmentedControl } from './ui/SegmentedControl';
import { SearchableSelectField } from './ui/SearchableSelectField';
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
    <div className="relative space-y-5 rounded-card border border-primary/20 bg-automation-action p-5 shadow-primary-button ring-1 ring-background/45 sm:p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-primary px-3 text-primary-foreground shadow-primary-soft">
          <span className="hp-type-control normal-case tracking-normal">{t('automations.summary.then')}</span>
        </div>
        <label className="hp-type-label-accent">{t('automations.builder.action_subtitle')}</label>
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
            <label className="hp-type-label-accent ml-1">{t('automations.form.target_device')}</label>
            <SearchableSelectField
              searchable
              value={actionConfig.targetDeviceId || ''}
              onChange={(value: string) => onActionConfigChange({ ...actionConfig, targetDeviceId: value })}
              options={devices.map(device => ({ value: device.id, label: humanize(device.id, device.name) }))}
              placeholder={t('automations.form.select_device')}
            />
          </div>
          <div className="space-y-2">
            <label className="hp-type-label-accent ml-1">{t('automations.form.action_type')}</label>
            <SearchableSelectField
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
            <label className="hp-type-label-accent ml-1">{t('automations.form.select_scene')}</label>
            <SearchableSelectField
              searchable
              value={actionConfig.sceneId || ''}
              onChange={(value: string) => onActionConfigChange({ ...actionConfig, sceneId: value })}
              options={scenes.map(scene => ({ value: scene.id, label: scene.name }))}
              placeholder={t('automations.form.select_scene')}
            />
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-4">
            <AlertCircle className="h-4 w-4 shrink-0 text-primary" />
            <p className="hp-type-body text-primary">{t('automations.builder.scene_info')}</p>
          </div>
        </div>
      )}
    </div>
  );
};
