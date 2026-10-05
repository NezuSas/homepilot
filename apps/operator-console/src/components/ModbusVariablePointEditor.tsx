import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modbusAddressProfiles } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import type { ModbusModuleCapacities } from '../../../../packages/integrations/modbus/domain/ModbusProfileDefinition';
import { plcRoles, type PlcRole } from '../../../../packages/integrations/modbus/domain/PlcBinding';
import { changeDraftProfile, changeDraftRole, displayedInputSource, hasPlcRelations, selectPhysicalPoint, selectPrimaryPoint, type ModbusVariableDraft } from '../lib/modbusSemanticDraft';
import { ModbusProfileSelect } from './ModbusAddressFields';
import { ModbusSemanticAddressField } from './ModbusSemanticAddressField';
import { PlcBindingEditor } from './PlcBindingEditor';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { ToggleSwitch } from './ui/ToggleSwitch';
import ConfirmModal from './ConfirmModal';

export function ModbusVariablePointEditor({ variable, onChange, capacities, advancedField, historical = false, usageSelected = true, onUsageSelected }: {
  variable: ModbusVariableDraft; onChange: (draft: ModbusVariableDraft) => void;
  capacities?: ModbusModuleCapacities; advancedField: React.ReactNode; historical?: boolean;
  usageSelected?: boolean; onUsageSelected?: () => void;
}) {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(!variable.plc || historical);
  const [pending, setPending] = useState<{ kind: 'role'; value?: PlcRole } | { kind: 'profile'; value: string } | null>(null);
  const profile = modbusAddressProfiles.find(item => item.id === variable.profileId);
  const plc = variable.plc;
  const primary = profile && variable.symbolicAddress ? { profileId: profile.id, symbolicAddress: variable.symbolicAddress, area: variable.area, address: variable.address } : undefined;
  const applyPending = () => {
    if (pending) onChange(pending.kind === 'role' ? changeDraftRole(variable, pending.value) : changeDraftProfile(variable, pending.value));
    setPending(null);
  };
  const commandField = profile && !advanced ? <ModbusSemanticAddressField profile={profile} role="output_command" label={t('plc.command_address')} value={plc?.command ?? primary} capacities={capacities}
    onChange={point => onChange(point ? selectPrimaryPoint(variable, point) : { ...variable, symbolicAddress: '', writable: false, plc: plc ? { ...plc, command: undefined } : undefined })} /> : advancedField;
  return <div className="min-w-0 space-y-4 sm:col-span-2" data-modbus-variable-point-editor>
    <div className="grid gap-3 sm:grid-cols-2">
      <SearchableSelectField label={t('plc.semantic.usage')} placeholder={t('plc.semantic.choose_usage')} value={usageSelected ? plc?.role ?? 'legacy' : ''} options={[{ value: 'legacy', label: t('plc.legacy') }, ...plcRoles.map(value => ({ value, label: t(`plc.roles.${value}`) }))]} onChange={value => {
        onUsageSelected?.();
        const role = plcRoles.find(role => role === value);
        if (role === plc?.role) return;
        if (hasPlcRelations(variable)) setPending({ kind: 'role', value: role });
        else onChange(changeDraftRole(variable, role));
      }} />
      <ModbusProfileSelect value={variable.profileId} onChange={value => {
        if (value === variable.profileId || (!value && !variable.profileId)) return;
        if (hasPlcRelations(variable) || variable.symbolicAddress) setPending({ kind: 'profile', value });
        else onChange(changeDraftProfile(variable, value));
      }} />
    </div>
    {!usageSelected ? <p role="status" className="text-body-compact text-muted-foreground">{t('plc.semantic.choose_usage_hint')}</p> : <>
    {profile && <div className="flex items-center justify-between gap-3"><span className="text-body-compact">{t('plc.semantic.advanced')}</span><ToggleSwitch label={t('plc.semantic.advanced')} checked={advanced} onCheckedChange={setAdvanced} /></div>}
    {profile && !advanced && plc ? <>
      {plc.role === 'output' || plc.role === 'input' ? <ModbusSemanticAddressField showAdvanced={false} profile={profile} role={plc.role} kind={plc.role === 'input' ? 'physical_input' : 'physical_output'} label={t(plc.role === 'input' ? 'plc.physical_input' : 'plc.physical_output')} value={plc.physical} capacities={capacities}
        onChange={point => onChange(point ? selectPhysicalPoint(variable, point) : { ...variable, plc: { ...plc, physical: undefined } })} /> : <ModbusSemanticAddressField showAdvanced={false} profile={profile} role={plc.role} label={t(plc.role === 'output_command' ? 'plc.command_address' : 'plc.semantic.point')} value={primary} capacities={capacities}
        onChange={point => onChange(point ? selectPrimaryPoint(variable, point) : { ...variable, symbolicAddress: '', writable: false })} />}
    </> : plc?.role !== 'output' ? advancedField : null}
    <PlcBindingEditor variable={variable} onChange={onChange} commandField={commandField} capacities={capacities} hideRole semantic={!!profile && !advanced} />
    {plc?.role === 'input' && <p role="status" className="text-caption text-muted-foreground">{t('plc.semantic.value_source', { symbol: displayedInputSource(variable) || t('plc.not_configured') })}</p>}
    </>}
    <ConfirmModal isOpen={pending !== null} onClose={() => setPending(null)} onConfirm={applyPending} variant="warning" title={t('plc.semantic.change_title')} description={t(pending?.kind === 'profile' ? 'plc.semantic.profile_change_warning' : 'plc.semantic.role_change_warning')} />
  </div>;
}
