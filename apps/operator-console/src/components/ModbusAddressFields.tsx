import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modbusAddressProfiles, resolveModbusAddress, resolveModbusRange, type ModbusModuleCapacities } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { ToggleSwitch } from './ui/ToggleSwitch';

/** Operate extension: symbols first, explicit effective PDU beside them; inherited palette and controls. */
export function ModbusProfileSelect({ value, onChange, disabled }: { value?: string; onChange: (value: string) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return <SearchableSelectField label={t('modbus.addressing')} value={value || 'generic'} disabled={disabled}
    options={[{ value: 'generic', label: t('modbus.generic') }, ...modbusAddressProfiles.map(profile => ({ value: profile.id, label: `${profile.manufacturer} ${profile.family} · ${profile.model} v${profile.version}` }))]}
    onChange={value => onChange(value === 'generic' ? '' : value)} />;
}
export function ModbusAddressFields({ profileId, symbol, end, capacities, disabled, onSymbol, onEnd, technicalDisclosure = false }: {
  profileId: string; symbol: string; end?: string; capacities?: ModbusModuleCapacities; disabled?: boolean;
  onSymbol: (value: string) => void; onEnd?: (value: string) => void;
  technicalDisclosure?: boolean;
}) {
  const { t } = useTranslation();
  let resolution: ReturnType<typeof resolveModbusRange> | undefined;
  try { resolution = end === undefined ? [resolveModbusAddress(profileId, symbol, capacities)] : resolveModbusRange(profileId, symbol, end, capacities); } catch { /* Invalid symbols are never sent to the PLC. */ }
  return <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-full">
    <div className="grid gap-3 sm:grid-cols-2">
      <Input label={t('modbus.symbol')} value={symbol} placeholder="D100" maxLength={32} disabled={disabled} required onChange={e => onSymbol(e.target.value.toUpperCase())} />
      {end !== undefined && onEnd && <Input label={t('modbus.symbol_end')} value={end} placeholder="D120" maxLength={32} disabled={disabled} required onChange={e => onEnd(e.target.value.toUpperCase())} />}
    </div>
    {resolution ? <>
      {technicalDisclosure ? <details className="text-caption text-muted-foreground"><summary className="cursor-pointer py-1">{t('plc.technical_address')}</summary><p role="status">{resolution[0].symbolicAddress} · {t(`modbus.${resolution[0].area}`)} · PDU {resolution[0].address}</p></details> : <p role="status" className="text-body-compact font-medium">{resolution[0].symbolicAddress}{resolution.length > 1 ? ` – ${resolution[resolution.length - 1].symbolicAddress}` : ''} · {t(`modbus.${resolution[0].area}`)} · PDU {resolution[0].address}{resolution.length > 1 ? ` – ${resolution[resolution.length - 1].address}` : ''}</p>}
      {resolution.some(item => !item.physicalCapacityKnown) && <p className="text-caption text-muted-foreground">{t('modbus.reserved_capacity')}</p>}
    </> : <p role="alert" className="text-caption text-destructive">{t('modbus.invalid_symbol')}</p>}
  </div>;
}
export function ModbusModuleCapacityFields({ capacities = {}, onChange, disabled }: {
  capacities?: ModbusModuleCapacities; onChange: (value: ModbusModuleCapacities) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [module, setModule] = useState('CPU');
  const current = capacities[module];
  return <div className="min-w-0 space-y-3 sm:col-span-2 lg:col-span-full">
    <SearchableSelectField label={t('modbus.physical_module')} value={module} disabled={disabled} options={['CPU', ...Array.from({ length: 16 }, (_, i) => String(i + 1))].map(value => ({ value, label: value === 'CPU' ? 'CPU' : t('modbus.expansion', { number: value }) }))} onChange={setModule} />
    <div className="flex items-center justify-between gap-3"><span className="text-body-compact">{t('modbus.capacity_known')}</span><ToggleSwitch label={t('modbus.capacity_known')} checked={!!current} disabled={disabled} onCheckedChange={known => { const next = { ...capacities }; if (known) next[module] = { inputs: 0, outputs: 0 }; else delete next[module]; onChange(next); }} /></div>
    {current && <div className="grid gap-3 sm:grid-cols-2">{(['inputs', 'outputs'] as const).map(channel => <NumberInput key={`${module}-${channel}`} label={t(`modbus.physical_${channel}`)} min={0} max={64} disabled={disabled} value={current[channel]} onValueChange={value => onChange({ ...capacities, [module]: { ...current, [channel]: value } })} onEmpty={() => onChange({ ...capacities, [module]: { ...current, [channel]: NaN } })} />)}</div>}
    <p className="text-caption text-muted-foreground">{t('modbus.capacity_hint')}</p>
  </div>;
}
