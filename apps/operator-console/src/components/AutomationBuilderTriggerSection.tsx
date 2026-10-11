import React from 'react';
import { Clock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { Card } from './ui/Card';
import { Input } from './ui/Input';
import { SurfaceButton } from './ui/SurfaceButton';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { SegmentedControl } from './ui/SegmentedControl';
import { AutomationDeviceSelect } from './AutomationDeviceSelect';
import type { AutomationBuilderDevice, AutomationTriggerConfig } from './AutomationBuilderTypes';

interface AutomationBuilderTriggerSectionProps {
  devices: AutomationBuilderDevice[];
  triggerType: 'device_state_changed' | 'time';
  triggerConfig: AutomationTriggerConfig;
  hours: { value: string; label: string }[];
  minutes: { value: string; label: string }[];
  onTriggerTypeChange: (triggerType: 'device_state_changed' | 'time') => void;
  onTriggerConfigChange: (triggerConfig: AutomationTriggerConfig) => void;
}

export const AutomationBuilderTriggerSection: React.FC<AutomationBuilderTriggerSectionProps> = ({
  devices,
  triggerType,
  triggerConfig,
  hours,
  minutes,
  onTriggerTypeChange,
  onTriggerConfigChange
}) => {
  const { t } = useTranslation();
  const selectedTime = triggerConfig.timeLocal || triggerConfig.time || '12:00';

  return (
    <Card className="relative space-y-5 overflow-visible p-5 sm:p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 px-3 shadow-sm">
          <span className="hp-type-control normal-case tracking-normal text-foreground">{t('automations.summary.if')}</span>
        </div>
        <label className="hp-type-label">{t('automations.builder.trigger_subtitle')}</label>
      </div>

      <SegmentedControl
        value={triggerType}
        tone="primary"
        onChange={onTriggerTypeChange}
        label={t('automations.builder.trigger_subtitle')}
        options={[
          { value: 'device_state_changed', label: t('automations.builder.properties.state'), icon: Zap },
          { value: 'time', label: t('common.time'), icon: Clock },
        ]}
      />

      {triggerType === 'device_state_changed' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-2">
            <AutomationDeviceSelect
              label={t('automations.form.source_device')}
              devices={devices}
              value={triggerConfig.deviceId || ''}
              onChange={(value: string) => onTriggerConfigChange({ ...triggerConfig, deviceId: value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="min-w-0">
              <SearchableSelectField
                label={t('automations.form.state_key')}
                value={triggerConfig.stateKey || 'state'}
                onChange={(value: string) => onTriggerConfigChange({ ...triggerConfig, stateKey: value })}
                options={[
                  { value: 'state', label: t('automations.builder.properties.state') },
                  { value: 'brightness', label: t('automations.builder.properties.lux') },
                  { value: 'temperature', label: t('automations.builder.properties.temp') },
                  { value: 'value', label: t('plc.measurement_value') }
                ]}
              />
            </div>
            <SearchableSelectField label={t('plc.comparison')} value={triggerConfig.comparison ?? 'eq'} options={(['eq', 'gt', 'gte', 'lt', 'lte'] as const).map(value => ({ value, label: t(`plc.comparisons.${value}`) }))} onChange={value => onTriggerConfigChange({ ...triggerConfig, comparison: value as AutomationTriggerConfig['comparison'] })} />
            <div className="min-w-0">
              <Input
                label={t('automations.form.expected_value')}
                value={triggerConfig.expectedValue || ''}
                onChange={(event) => onTriggerConfigChange({ ...triggerConfig, expectedValue: event.target.value })}
                placeholder={t('automations.builder.placeholders.expected_value')}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-2">
            <label className="hp-type-label ml-1">{t('automations.form.time_label')}</label>
            <div className="flex items-center gap-2">
              <SearchableSelectField
                value={selectedTime.split(':')[0]}
                onChange={(hour: string) => {
                  const minute = selectedTime.split(':')[1] || '00';
                  onTriggerConfigChange({ ...triggerConfig, timeLocal: `${hour}:${minute}` });
                }}
                options={hours}
                className="flex-1 text-center"
              />
              <span className="hp-type-card-title text-muted-foreground/35">:</span>
              <SearchableSelectField
                value={selectedTime.split(':')[1] || '00'}
                onChange={(minute: string) => {
                  const hour = selectedTime.split(':')[0] || '12';
                  onTriggerConfigChange({ ...triggerConfig, timeLocal: `${hour}:${minute}` });
                }}
                options={minutes}
                className="flex-1 text-center"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="hp-type-label ml-1">{t('automations.form.days_label')}</label>
            <div className="grid grid-cols-7 gap-1">
              {(t('common.days_min', { returnObjects: true }) as string[]).map((day, index) => {
                const selectedDays = triggerConfig.days || [0, 1, 2, 3, 4, 5, 6];
                const isSelected = selectedDays.includes(index);
                return (
                  <SurfaceButton
                    type="button"
                    key={index}
                    aria-pressed={isSelected}
                    onClick={() => {
                      const next = isSelected ? selectedDays.filter(dayIndex => dayIndex !== index) : [...selectedDays, index];
                      onTriggerConfigChange({ ...triggerConfig, days: next });
                    }}
                    className={cn(
                      "hp-type-control flex min-h-11 w-full items-center justify-center rounded-control border px-1",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/55 bg-background/70 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    {day}
                  </SurfaceButton>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
