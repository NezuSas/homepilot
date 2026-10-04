import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { plcRoles, type PlcAddress, type PlcBinding } from '../../../../packages/integrations/modbus/domain/PlcBinding';
import { modbusAddressProfiles, resolveModbusAddress, type ModbusModuleCapacities } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { AlertBanner } from './ui/AlertBanner';
import { Button } from './ui/Button';
import { plcFeedbackPolicies, plcCommandModes } from '../lib/plcUi';

type Draft = Omit<ModbusVariable, 'deviceId' | 'connectionId'>;
/** Local extension: inherited palette; explicit relationships, no inferred Ladder. */
export function PlcBindingEditor({ variable, onChange, commandField, capacities }: { variable: Draft; onChange: (value: Draft) => void; commandField?: ReactNode; capacities?: ModbusModuleCapacities }) {
  const { t } = useTranslation();
  const plc = variable.plc;
  const update = (fields: Partial<PlcBinding>) => { if (plc) onChange({ ...variable, plc: { ...plc, ...fields } }); };
  const resolve = (symbol: string): PlcAddress => {
    const profileId = variable.profileId ?? '';
    try { const result = resolveModbusAddress(profileId, symbol, capacities); return { profileId, symbolicAddress: result.symbolicAddress, area: result.area, address: result.address }; }
    catch { return { profileId, symbolicAddress: symbol.toUpperCase(), area: 'coil', address: -1 }; }
  };
  const profile = modbusAddressProfiles.find(item => item.id === variable.profileId);
  const outputOptions = profile?.segments.filter(segment => segment.channel === 'outputs').flatMap(segment =>
    Array.from({ length: segment.count }, (_, index) => profile.format(segment, segment.first + index)).flatMap(symbol => {
      try {
        resolveModbusAddress(profile.id, symbol, capacities);
        return plc?.relatedPhysicalOutputs?.some(point => point.symbolicAddress === symbol) ? [] : [{ value: symbol, label: symbol, group: segment.module }];
      } catch { return []; }
    })) ?? [];
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
        {plc.role === 'output_command' && <div className="min-w-0 space-y-2">
          <SearchableSelectField label={t('plc.related_outputs')} value="" placeholder={t('plc.add_related_output')} options={outputOptions} disabled={!profile || !!plc.physical} onChange={symbol => update({ relatedPhysicalOutputs: [...(plc.relatedPhysicalOutputs ?? []), resolve(symbol)] })} />
          <ul aria-label={t('plc.related_outputs')} className="flex flex-wrap gap-2">{plc.relatedPhysicalOutputs?.map(point => <li key={`${point.area}:${point.address}`}><Button type="button" variant="secondary" aria-label={t('plc.remove_related_output', { symbol: point.symbolicAddress })} onClick={() => update({ relatedPhysicalOutputs: plc.relatedPhysicalOutputs?.filter(item => item !== point) })}>{point.symbolicAddress}<X aria-hidden="true" className="size-4" /></Button></li>)}</ul>
          <p className="text-caption text-muted-foreground">{t('plc.related_outputs_hint')}</p>
        </div>}
        {['input', 'output'].includes(plc.role) && <Input label={t(plc.role === 'output' ? 'plc.physical_output' : 'plc.physical_input')} value={plc.physical?.symbolicAddress ?? ''} maxLength={32} helperText={plc.role === 'output' ? t('plc.physical_hint') : undefined} onChange={event => update({ physical: event.target.value ? resolve(event.target.value) : undefined })} />}
        {plc.role === 'output' && commandField}
        {plc.role === 'input' && <Input label={t('plc.logical')} value={plc.logical?.symbolicAddress ?? ''} maxLength={32} onChange={event => update({ logical: event.target.value ? resolve(event.target.value) : undefined })} />}
        {['output', 'output_command'].includes(plc.role) && <>
          <SearchableSelectField label={t('plc.feedback_policy')} value={plc.feedbackPolicy} options={plcFeedbackPolicies.map(value => ({ value, label: t(`plc.policies.${value}`) }))} onChange={value => { const policy = plcFeedbackPolicies.find(policy => policy === value); if (policy) update({ feedbackPolicy: policy, ...(policy === 'none' ? { feedback: undefined } : {}) }); }} />
          {plc.feedbackPolicy !== 'none' && <>
            <Input label={t('plc.feedback')} helperText={t('plc.feedback_hint')} value={plc.feedback?.symbolicAddress ?? ''} maxLength={32} required onChange={event => update({ feedback: resolve(event.target.value) })} />
            <NumberInput label={t('plc.feedback_timeout')} min={250} max={10000} value={plc.feedbackTimeoutMs} onValueChange={feedbackTimeoutMs => update({ feedbackTimeoutMs })} onEmpty={() => update({ feedbackTimeoutMs: NaN })} />
          </>}
          <SearchableSelectField label={t('plc.mode')} value={plc.mode} options={plcCommandModes.map(value => ({ value, label: t(`plc.modes.${value}`) }))} onChange={value => { const mode = plcCommandModes.find(mode => mode === value); if (mode) update({ mode }); }} />
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
