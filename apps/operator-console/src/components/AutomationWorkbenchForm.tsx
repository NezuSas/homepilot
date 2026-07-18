import React from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Play, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { SearchableSelectField } from './ui/SearchableSelectField';

export interface AutomationWorkbenchDevice {
  id: string;
  name: string;
  type: string;
}

export interface AutomationWorkbenchFormData {
  name: string;
  triggerDeviceId: string;
  stateKey: string;
  expectedValue: string;
  targetDeviceId: string;
  command: string;
}

interface AutomationWorkbenchFormProps {
  formData: AutomationWorkbenchFormData;
  devices: AutomationWorkbenchDevice[];
  editingId: string | null;
  submitting: boolean;
  success: boolean;
  createError: string | null;
  onSubmit: (event: React.FormEvent) => void;
  onChange: (formData: AutomationWorkbenchFormData) => void;
}

export const AutomationWorkbenchForm: React.FC<AutomationWorkbenchFormProps> = ({
  formData,
  devices,
  editingId,
  submitting,
  success,
  createError,
  onSubmit,
  onChange
}) => {
  const { t } = useTranslation();
  const deviceOptions = devices.map(device => ({ value: device.id, label: `${device.name} (${device.type})` }));

  return (
    <form onSubmit={onSubmit} className="relative overflow-hidden rounded-panel border-2 border-primary/20 bg-card p-4 shadow-2xl animate-in zoom-in-95 duration-300 sm:p-6 lg:rounded-hero lg:p-10">
      {success && (
        <div className="absolute inset-0 bg-primary/95 backdrop-blur-md flex flex-col items-center justify-center text-primary-foreground z-10 animate-in fade-in transition-all">
          <CheckCircle2 className="w-16 h-16 mb-4 animate-bounce" />
          <span className="text-panel-title font-black uppercase tracking-tighter">{editingId ? t('automations.rule_updated') : t('automations.rule_created')}</span>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2 md:gap-8 lg:gap-10">
        <div className="flex flex-col gap-5 sm:gap-6">
          <div className="flex flex-col gap-2">
            <Input
              label={t('automations.form.rule_name')}
              required
              value={formData.name}
              onChange={event => onChange({ ...formData, name: event.target.value })}
              placeholder={t('automations.form.rule_name_placeholder')}
            />
          </div>

          <div className="flex flex-col gap-5 rounded-panel border border-border/40 bg-muted/20 p-4 sm:p-6 lg:rounded-dashboard lg:p-8">
            <span className="text-micro font-black uppercase tracking-label text-primary/60 mb-2 flex items-center gap-2">
              <Play className="w-3 h-3 fill-current" /> {t('automations.form.trigger_config')}
            </span>

            <SearchableSelectField
              label={t('automations.form.source_device')}
              required
              value={formData.triggerDeviceId}
              placeholder={t('automations.form.select_device')}
              onChange={value => onChange({ ...formData, triggerDeviceId: value })}
              options={deviceOptions}
            />

            <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2">
              <Input
                label={t('automations.form.state_key')}
                required
                value={formData.stateKey}
                onChange={event => onChange({ ...formData, stateKey: event.target.value })}
                className="font-mono"
              />
              <Input
                label={t('automations.form.value_label')}
                required
                value={formData.expectedValue}
                onChange={event => onChange({ ...formData, expectedValue: event.target.value })}
                className="font-mono"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-5 sm:gap-6">
          <div className="flex flex-col gap-5 rounded-panel border-2 border-primary/10 bg-primary/[0.03] p-4 shadow-inner sm:p-6 lg:rounded-dashboard lg:p-8">
            <span className="text-micro font-black uppercase tracking-label text-primary mb-2 flex items-center gap-2">
              <Zap className="w-3 h-3 fill-current" /> {t('automations.form.action_result')}
            </span>

            <SearchableSelectField
              label={t('automations.form.target_device')}
              required
              value={formData.targetDeviceId}
              placeholder={t('automations.form.select_target')}
              onChange={value => onChange({ ...formData, targetDeviceId: value })}
              options={deviceOptions}
            />

            <SearchableSelectField
              label={t('automations.form.command')}
              required
              value={formData.command}
              onChange={value => onChange({ ...formData, command: value })}
              options={[
                { value: 'turn_on', label: t('common.on') },
                { value: 'turn_off', label: t('common.off') },
                { value: 'toggle', label: t('common.actions.toggle') }
              ]}
            />
          </div>

          <div className="flex flex-col gap-4 mt-auto">
            {createError && (
              <div className="bg-danger/10 border border-danger/20 text-danger text-micro font-bold p-4 rounded-2xl flex items-center gap-3 animate-shake">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {createError}
              </div>
            )}
            <Button
              disabled={submitting}
              type="submit"
              size="lg"
              className="w-full text-caption font-black uppercase tracking-label-wider flex items-center justify-center gap-4 group"
              isLoading={submitting}
            >
              <>
                {editingId ? t('automations.update_button') : t('automations.save_button')}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
              </>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
