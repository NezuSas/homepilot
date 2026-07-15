import React from 'react';
import { Clock, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Select from '../views/Select';
import { cn } from '../lib/utils';
import { humanize } from '../lib/naming-utils';
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
    <div className="relative space-y-5 rounded-[1.75rem] border border-border/55 bg-card/80 p-5 shadow-[0_16px_44px_hsl(var(--foreground)/0.07)] ring-1 ring-background/45 sm:p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/90 px-3 shadow-sm">
          <span className="text-[9px] font-black text-foreground">{t('automations.summary.if')}</span>
        </div>
        <label className="text-[9px] font-black uppercase tracking-[0.28em] text-muted-foreground">{t('automations.builder.trigger_subtitle')}</label>
      </div>

      <div className="flex gap-2 rounded-2xl border border-border/55 bg-background/75 p-1.5 shadow-inner">
        <button
          type="button"
          onClick={() => onTriggerTypeChange('device_state_changed')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all",
            triggerType === 'device_state_changed'
              ? "bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.24)]"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          )}
        >
          <Zap className="w-3 h-3" /> {t('automations.builder.properties.state')}
        </button>
        <button
          type="button"
          onClick={() => onTriggerTypeChange('time')}
          className={cn(
            "flex flex-1 items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-black uppercase tracking-widest transition-all",
            triggerType === 'time'
              ? "bg-primary text-primary-foreground shadow-[0_10px_24px_hsl(var(--primary)/0.24)]"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          )}
        >
          <Clock className="w-3 h-3" /> {t('common.time', { defaultValue: 'Time' })}
        </button>
      </div>

      {triggerType === 'device_state_changed' ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-2">
            <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t('automations.form.source_device')}</label>
            <Select
              searchable
              value={triggerConfig.deviceId || ''}
              onChange={(value: string) => onTriggerConfigChange({ ...triggerConfig, deviceId: value })}
              options={devices.map(device => ({ value: device.id, label: humanize(device.id, device.name) }))}
              placeholder={t('automations.form.select_device')}
            />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div className="space-y-2 col-span-3">
              <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t('automations.form.state_key')}</label>
              <Select
                value={triggerConfig.stateKey || 'state'}
                onChange={(value: string) => onTriggerConfigChange({ ...triggerConfig, stateKey: value })}
                options={[
                  { value: 'state', label: t('automations.builder.properties.state') },
                  { value: 'brightness', label: t('automations.builder.properties.lux') },
                  { value: 'temperature', label: t('automations.builder.properties.temp') }
                ]}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t('automations.form.expected_value')}</label>
              <input
                type="text"
                value={triggerConfig.expectedValue || ''}
                onChange={(event) => onTriggerConfigChange({ ...triggerConfig, expectedValue: event.target.value })}
                placeholder={t('automations.builder.placeholders.expected_value')}
                className="h-11 w-full translate-y-[1px] rounded-xl border border-border/55 bg-background/80 px-4 text-sm font-bold tracking-tight text-foreground outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary/55 focus:bg-card focus:shadow-[0_0_0_4px_hsl(var(--primary)/0.10)]"
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="space-y-2">
            <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t('automations.form.time_label')}</label>
            <div className="flex items-center gap-2">
              <Select
                value={selectedTime.split(':')[0]}
                onChange={(hour: string) => {
                  const minute = selectedTime.split(':')[1] || '00';
                  onTriggerConfigChange({ ...triggerConfig, timeLocal: `${hour}:${minute}` });
                }}
                options={hours}
                className="flex-1 text-center"
              />
              <span className="text-lg font-black text-muted-foreground/35">:</span>
              <Select
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
            <label className="ml-1 text-[8px] font-black uppercase tracking-widest text-muted-foreground">{t('automations.form.days_label')}</label>
            <div className="grid grid-cols-7 gap-1">
              {(t('common.days_min', { returnObjects: true }) as string[]).map((day, index) => {
                const selectedDays = triggerConfig.days || [0, 1, 2, 3, 4, 5, 6];
                const isSelected = selectedDays.includes(index);
                return (
                  <button
                    type="button"
                    key={index}
                    onClick={() => {
                      const next = isSelected ? selectedDays.filter(dayIndex => dayIndex !== index) : [...selectedDays, index];
                      onTriggerConfigChange({ ...triggerConfig, days: next });
                    }}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-xl border text-[9px] font-black transition-all",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground shadow-[0_8px_18px_hsl(var(--primary)/0.22)]"
                        : "border-border/55 bg-background/70 text-muted-foreground hover:bg-muted/70 hover:text-foreground"
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
  );
};
