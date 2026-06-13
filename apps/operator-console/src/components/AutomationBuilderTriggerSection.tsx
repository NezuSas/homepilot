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
    <div className="space-y-4 p-6 rounded-[2rem] bg-muted/10 border border-border/10 relative">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-8 px-3 rounded-full bg-background border flex items-center justify-center shrink-0 min-w-8">
          <span className="text-[9px] font-black">{t('automations.summary.if')}</span>
        </div>
        <label className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-60">{t('automations.builder.trigger_subtitle')}</label>
      </div>

      <div className="flex bg-background/50 p-1.5 rounded-2xl gap-2 border border-border/10">
        <button
          onClick={() => onTriggerTypeChange('device_state_changed')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            triggerType === 'device_state_changed' ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:bg-foreground/5"
          )}
        >
          <Zap className="w-3 h-3" /> {t('automations.builder.properties.state')}
        </button>
        <button
          onClick={() => onTriggerTypeChange('time')}
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
              onChange={(value: string) => onTriggerConfigChange({ ...triggerConfig, deviceId: value })}
              options={devices.map(device => ({ value: device.id, label: humanize(device.id, device.name) }))}
              placeholder={t('automations.form.select_device')}
            />
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div className="space-y-2 col-span-3">
              <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.state_key')}</label>
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
              <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.expected_value')}</label>
              <input
                type="text"
                value={triggerConfig.expectedValue || ''}
                onChange={(event) => onTriggerConfigChange({ ...triggerConfig, expectedValue: event.target.value })}
                placeholder={t('automations.builder.placeholders.expected_value')}
                className="w-full h-11 bg-foreground/[0.03] border border-foreground/10 rounded-xl px-4 text-sm font-bold tracking-tight focus:border-primary/50 focus:ring-0 transition-all placeholder:opacity-20 translate-y-[1px]"
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
                value={selectedTime.split(':')[0]}
                onChange={(hour: string) => {
                  const minute = selectedTime.split(':')[1] || '00';
                  onTriggerConfigChange({ ...triggerConfig, timeLocal: `${hour}:${minute}` });
                }}
                options={hours}
                className="flex-1 text-center"
              />
              <span className="text-lg font-black opacity-10">:</span>
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
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground opacity-50 ml-1">{t('automations.form.days_label')}</label>
            <div className="grid grid-cols-7 gap-1">
              {(t('common.days_min', { returnObjects: true }) as string[]).map((day, index) => {
                const selectedDays = triggerConfig.days || [0, 1, 2, 3, 4, 5, 6];
                const isSelected = selectedDays.includes(index);
                return (
                  <button
                    key={index}
                    onClick={() => {
                      const next = isSelected ? selectedDays.filter(dayIndex => dayIndex !== index) : [...selectedDays, index];
                      onTriggerConfigChange({ ...triggerConfig, days: next });
                    }}
                    className={cn(
                      "w-full aspect-square rounded-lg font-black text-[9px] transition-all border-2 flex items-center justify-center",
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
  );
};
