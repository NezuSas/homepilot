import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modbusAddressProfiles, resolveModbusAddress, resolveModbusRange, type ModbusModuleCapacities } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { ToggleSwitch } from './ui/ToggleSwitch';
import { profileModules } from '../../../../packages/integrations/modbus/domain/ModbusProfileMetadata';

/** Operate extension: symbols first, explicit effective PDU beside them; inherited palette and controls. */
export function ModbusProfileSelect({ value, onChange, disabled }: { value?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <SearchableSelectField label={t('modbus.addressing')} value={value || 'generic'} disabled={disabled}
    options={[{ value: 'generic', label: t('modbus.generic') }, ...modbusAddressProfiles.map(profile => ({ value: profile.id, label: `${profile.manufacturer} ${profile.family} · ${profile.model} v${profile.version}` }))]}
    onChange={value => onChange(value === 'generic' ? '' : value)} />;
}
export function ModbusAddressFields({ profileId, symbol, end, capacities, disabled, onSymbol, onEnd, technicalDisclosure = false, symbolLabel, compact = false, optional = false }: {
  profileId: string; symbol: string; end?: string; capacities?: ModbusModuleCapacities; disabled?: boolean;
  onSymbol: (value: string) => void; onEnd?: (value: string) => void;
  technicalDisclosure?: boolean;
  symbolLabel?: string;
  compact?: boolean;
  optional?: boolean;
}) {
  const { t } = useTranslation();
  let resolution: ReturnType<typeof resolveModbusRange> | undefined;
  const profile = modbusAddressProfiles.find(item => item.id === profileId);
  const exampleSegment = profile?.segments[0];
  const example = profile && exampleSegment ? profile.format(exampleSegment, exampleSegment.first) : undefined;
  try { resolution = end === undefined ? [resolveModbusAddress(profileId, symbol, capacities)] : resolveModbusRange(profileId, symbol, end, capacities); } catch { /* Invalid symbols are never sent to the PLC. */ }
  return <div className={compact ? 'min-w-0 space-y-2' : 'min-w-0 space-y-2 sm:col-span-2 lg:col-span-full'}>
    <div className={compact ? 'grid gap-3' : 'grid gap-3 sm:grid-cols-2'}>
      <Input label={symbolLabel ?? t('modbus.symbol')} value={symbol} placeholder={example} maxLength={32} disabled={disabled} required={!optional} onChange={e => onSymbol(e.target.value)} />
      {end !== undefined && onEnd && <Input label={t('modbus.symbol_end')} value={end} placeholder={example} maxLength={32} disabled={disabled} required onChange={e => onEnd(e.target.value)} />}
    </div>
    {resolution ? <>
      {technicalDisclosure ? <details className="text-caption text-muted-foreground"><summary className="cursor-pointer py-1">{t('plc.technical_address')}</summary><p role="status">{resolution[0].symbolicAddress} · {t(`modbus.${resolution[0].area}`)} · PDU {resolution[0].address}</p></details> : <p role="status" className="text-body-compact font-medium">{resolution[0].symbolicAddress}{resolution.length > 1 ? ` – ${resolution[resolution.length - 1].symbolicAddress}` : ''} · {t(`modbus.${resolution[0].area}`)} · PDU {resolution[0].address}{resolution.length > 1 ? ` – ${resolution[resolution.length - 1].address}` : ''}</p>}
      {resolution.some(item => !item.physicalCapacityKnown) && <p className="text-caption text-muted-foreground">{t('modbus.reserved_capacity')}</p>}
    </> : (!optional || symbol) && <p role="alert" className="text-caption text-destructive">{t('modbus.invalid_symbol')}</p>}
  </div>;
}
export function ModbusModuleCapacityFields({ capacities = {}, onChange, disabled, profileId }: {
  capacities?: ModbusModuleCapacities; onChange: (value: ModbusModuleCapacities) => void; disabled?: boolean;
  profileId?: string;
}) {
  const { t } = useTranslation();
  const [selectedModule, setModule] = useState('');
  const profile = modbusAddressProfiles.find(item => item.id === profileId);
  const modules = profile ? profileModules(profile) : [];
  const module = modules.find(item => item.id === selectedModule)?.id ?? modules[0]?.id ?? '';
  const metadata = modules.find(item => item.id === module);
  const current = capacities[module];
  return <div className="min-w-0 space-y-3 sm:col-span-2 lg:col-span-full">
    <SearchableSelectField label={t('modbus.physical_module')} value={module} disabled={disabled || !modules.length} options={modules.map(item => ({ value: item.id, label: item.id }))} onChange={setModule} />
    <div className="flex items-center justify-between gap-3"><span className="text-body-compact">{t('modbus.capacity_known')}</span><ToggleSwitch label={t('modbus.capacity_known')} checked={!!current} disabled={disabled} onCheckedChange={known => { const next = { ...capacities }; if (known) next[module] = { inputs: 0, outputs: 0 }; else delete next[module]; onChange(next); }} /></div>
    {current && <div className="grid gap-3 sm:grid-cols-2">{metadata?.channels.map(item => item.channel && <NumberInput key={`${module}-${item.channel}`} label={t(`modbus.physical_${item.channel}`)} min={0} max={item.reservedCount} disabled={disabled} value={current[item.channel]} onValueChange={value => onChange({ ...capacities, [module]: { ...current, [item.channel!]: value } })} onEmpty={() => onChange({ ...capacities, [module]: { ...current, [item.channel!]: NaN } })} />)}</div>}
    <p className="text-caption text-muted-foreground">{t('modbus.capacity_hint')}</p>
  </div>;
}
