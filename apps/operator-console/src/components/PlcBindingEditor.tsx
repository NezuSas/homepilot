import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { plcRoles, type PlcAddress, type PlcBinding } from '../../../../packages/integrations/modbus/domain/PlcBinding';
import { resolveModbusAddress } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { AlertBanner } from './ui/AlertBanner';

type Draft = Omit<ModbusVariable, 'deviceId' | 'connectionId'>;
/** Local extension: inherited palette; explicit relationships, no inferred Ladder. */
export function PlcBindingEditor({ variable, onChange, commandField }: { variable: Draft; onChange: (value: Draft) => void; commandField?: ReactNode }) {
  const { t } = useTranslation();
  const plc = variable.plc;
  const update = (fields: Partial<PlcBinding>) => { if (plc) onChange({ ...variable, plc: { ...plc, ...fields } }); };
  const resolve = (symbol: string): PlcAddress => {
    const profileId = variable.profileId ?? '';
    try { const result = resolveModbusAddress(profileId, symbol); return { profileId, symbolicAddress: result.symbolicAddress, area: result.area, address: result.address }; }
    catch { return { profileId, symbolicAddress: symbol.toUpperCase(), area: 'coil', address: -1 }; }
  };
  return <fieldset className="min-w-0 space-y-3 border-t border-border pt-3 sm:col-span-2">
    <legend className="px-1 text-body-compact font-semibold">{t('plc.title')}</legend>
    <SearchableSelectField label={t('plc.role')} value={plc?.role ?? 'legacy'} options={[{ value: 'legacy', label: t('plc.legacy') }, ...plcRoles.map(value => ({ value, label: t(`plc.roles.${value}`) }))]} onChange={role => {
      const selected = plcRoles.find(value => value === role);
      onChange({ ...variable, writable: false, plc: selected ? { role: selected, feedbackPolicy: 'none', feedbackTimeoutMs: 2000, mode: 'sustained', pulseDurationMs: 500, ...(['output', 'output_command'].includes(selected) ? { command: resolve(variable.symbolicAddress ?? '') } : {}), ...(selected === 'setpoint' ? { min: 0, max: 100 } : {}) } : undefined });
    }} />
    {plc && <>
      {!variable.profileId && <AlertBanner variant="warning" message={t('plc.profile_required')} />}
      <div className="grid gap-3 sm:grid-cols-2">
        {plc.role === 'output_command' && <Input label={t('plc.command')} value={variable.symbolicAddress ?? ''} readOnly helperText={t('plc.command_hint')} />}
        {['input', 'output'].includes(plc.role) && <Input label={t(plc.role === 'output' ? 'plc.physical_output' : 'plc.physical_input')} value={plc.physical?.symbolicAddress ?? ''} maxLength={32} containerClassName={plc.role === 'output' ? 'sm:col-span-2' : undefined} className={plc.role === 'output' ? 'font-semibold' : undefined} onChange={event => update({ physical: event.target.value ? resolve(event.target.value) : undefined })} />}
        {plc.role === 'output' && commandField}
        {plc.role === 'input' && <Input label={t('plc.logical')} value={plc.logical?.symbolicAddress ?? ''} maxLength={32} onChange={event => update({ logical: event.target.value ? resolve(event.target.value) : undefined })} />}
        {['output', 'output_command'].includes(plc.role) && <>
          <SearchableSelectField label={t('plc.feedback_policy')} value={plc.feedbackPolicy} options={['none', 'optional', 'required'].map(value => ({ value, label: t(`plc.policies.${value}`) }))} onChange={value => update({ feedbackPolicy: value as PlcBinding['feedbackPolicy'], ...(value === 'none' ? { feedback: undefined } : {}) })} />
          {plc.feedbackPolicy !== 'none' && <>
            <Input label={t('plc.feedback')} value={plc.feedback?.symbolicAddress ?? ''} maxLength={32} required onChange={event => update({ feedback: resolve(event.target.value) })} />
            <NumberInput label={t('plc.feedback_timeout')} min={250} max={10000} value={plc.feedbackTimeoutMs} onValueChange={feedbackTimeoutMs => update({ feedbackTimeoutMs })} onEmpty={() => update({ feedbackTimeoutMs: NaN })} />
          </>}
          <SearchableSelectField label={t('plc.mode')} value={plc.mode} options={['sustained', 'pulse'].map(value => ({ value, label: t(`plc.modes.${value}`) }))} onChange={value => update({ mode: value as PlcBinding['mode'] })} />
          {plc.mode === 'pulse' && <NumberInput label={t('plc.pulse_duration')} min={100} max={5000} value={plc.pulseDurationMs} onValueChange={pulseDurationMs => update({ pulseDurationMs })} onEmpty={() => update({ pulseDurationMs: NaN })} />}
        </>}
        {plc.role === 'setpoint' && <>
          <NumberInput label={t('plc.minimum')} value={plc.min ?? NaN} step="any" onValueChange={min => update({ min })} onEmpty={() => update({ min: NaN })} />
          <NumberInput label={t('plc.maximum')} value={plc.max ?? NaN} step="any" onValueChange={max => update({ max })} onEmpty={() => update({ max: NaN })} />
        </>}
      </div>
      {plc.mode === 'pulse' && <AlertBanner variant="warning" message={t('plc.watchdog_warning')} />}
      {plc.role === 'setpoint' && <p className="text-caption text-muted-foreground">{t('plc.setpoint_hint')}</p>}
    </>}
  </fieldset>;
}
