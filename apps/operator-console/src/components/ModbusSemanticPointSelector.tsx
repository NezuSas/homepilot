import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlcAddress, PlcRole } from '../../../../packages/integrations/modbus/domain/PlcBinding';
import type { ModbusAddressProfile, ModbusAddressSegment, ModbusModuleCapacities, ModbusPointKind } from '../../../../packages/integrations/modbus/domain/ModbusProfileDefinition';
import { profileChannel, profileRoleSegments, profileSegmentCapacity } from '../../../../packages/integrations/modbus/domain/ModbusProfileMetadata';
import { plcPointAddress } from '../lib/modbusSemanticDraft';
import { plcReadFunction } from '../lib/plcUi';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { NumberInput } from './ui/NumberInput';
import { AlertBanner } from './ui/AlertBanner';

export interface ModbusSemanticPointSelectorProps {
  profile: ModbusAddressProfile;
  role: PlcRole;
  kind?: ModbusPointKind;
  value?: PlcAddress;
  capacities?: ModbusModuleCapacities;
  label: string;
  disabled?: boolean;
  optional?: boolean;
  onChange: (point: PlcAddress | undefined) => void;
}

/** Metadata-driven selection only. The profile alone formats and resolves symbols. */
export function ModbusSemanticPointSelector({ profile, role, kind, value, capacities, label, disabled, optional, onChange }: ModbusSemanticPointSelectorProps) {
  const { t } = useTranslation();
  const [chosenSegment, setChosenSegment] = useState<ModbusAddressSegment>();
  let resolved: ReturnType<ModbusAddressProfile['resolve']> | undefined;
  let invalidCapacity = false;
  try { profile.validateCapacities(capacities); } catch { invalidCapacity = true; }
  try { if (value?.profileId === profile.id) resolved = profile.resolve(value.symbolicAddress, capacities); } catch { /* Keep historical configuration visible below. */ }
  const segments = profileRoleSegments(profile, role).filter(segment => !kind || segment.semantics?.kind === kind);
  const compatible = resolved && segments.includes(resolved.segment);
  const segment = chosenSegment && segments.includes(chosenSegment) ? chosenSegment : compatible && resolved ? resolved.segment : segments[0];
  const familyId = segment?.semantics?.familyId;
  const families = [...new Map(segments.map(item => [item.semantics!.familyId, item])).values()];
  const familySegments = segments.filter(item => item.semantics?.familyId === familyId);
  let capacity: ReturnType<typeof profileSegmentCapacity> | undefined;
  try { if (segment) capacity = profileSegmentCapacity(profile, segment, capacities); } catch { /* No selections with invalid capacity. */ }
  const select = (target: ModbusAddressSegment | undefined, ordinal: number) => {
    if (!target) return;
    setChosenSegment(target);
    try { onChange(plcPointAddress(profile, profileChannel(profile, target, ordinal, capacities))); } catch {
      if (profileSegmentCapacity(profile, target, capacities).selectableCount === 0) onChange(undefined);
      // Native constraints and warning keep invalid drafts local.
    }
  };
  return <fieldset className="min-w-0 space-y-2" data-modbus-semantic-point={label} disabled={disabled}>
    <legend className="mb-2 text-body-compact font-medium">{label}</legend>
    {!segments.length || invalidCapacity ? <AlertBanner variant="warning" message={t(invalidCapacity ? 'plc.semantic.invalid_capacity' : 'plc.semantic.no_options')} /> : <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <SearchableSelectField label={t('plc.semantic.family')} value={familyId ?? ''} disabled={disabled}
        options={families.map(item => ({ value: item.semantics!.familyId, label: `${t(`plc.semantic.kinds.${item.semantics!.kind}`)} · ${item.semantics!.familyId}` }))}
        onChange={id => select(segments.find(item => item.semantics?.familyId === id), 0)} />
      {segment?.module && <SearchableSelectField label={t('modbus.physical_module')} value={segment.module} disabled={disabled}
        options={familySegments.map(item => ({ value: item.module ?? '', label: item.module ?? '' }))}
        onChange={id => select(familySegments.find(item => item.module === id), 0)} />}
      {segment && <NumberInput key={`${profile.id}:${role}:${segment.prefix}:${segment.first}`} label={t(segment.module ? 'plc.semantic.channel' : 'plc.semantic.index')} required={!optional && !value} min={0} max={(capacity?.selectableCount ?? segment.count) - 1}
        disabled={disabled || capacity?.selectableCount === 0} value={compatible && resolved && resolved.segment === segment ? resolved.address - resolved.segment.base : undefined}
        helperText={t('plc.semantic.ordinal_hint')} onValueChange={ordinal => select(segment, ordinal)} onEmpty={() => onChange(undefined)} />}
    </div>}
    {value && !compatible && <AlertBanner variant="warning" message={t('plc.semantic.historical_point', { symbol: value.symbolicAddress })} />}
    {resolved && <div role="status" className="min-w-0 space-y-1 text-caption text-muted-foreground" data-modbus-point-summary>
      <p className="break-words text-body-compact font-semibold text-foreground">{resolved.symbolicAddress}</p>
      <p>{resolved.segment.semantics ? t(`plc.semantic.kinds.${resolved.segment.semantics.kind}`) : t('plc.technical_address')}{resolved.segment.module ? ` · ${resolved.segment.module}` : ''}</p>
      <p className="tabular-nums">{t(`modbus.${resolved.area}`)} · PDU {resolved.address} · {plcReadFunction(resolved.area)} · {t('plc.semantic.radix', { radix: resolved.segment.radix })}</p>
    </div>}
    {capacity?.selectableCount === 0 && <p role="status" className="text-caption text-muted-foreground">{t('plc.semantic.no_channels')}</p>}
    {capacity && !capacity.capacityKnown && <p className="text-caption text-muted-foreground">{t('modbus.reserved_capacity')}</p>}
  </fieldset>;
}
