import { useTranslation } from 'react-i18next';
import { ModbusSemanticPointSelector, type ModbusSemanticPointSelectorProps } from './ModbusSemanticPointSelector';
import { ModbusAddressFields } from './ModbusAddressFields';
import { plcPointAddress } from '../lib/modbusSemanticDraft';
import { Button } from './ui/Button';

/** Optional relationships expose a technical escape hatch without guessing a point. */
export function ModbusSemanticAddressField({ showAdvanced = true, ...props }: ModbusSemanticPointSelectorProps & { showAdvanced?: boolean }) {
  const { t } = useTranslation();
  return <div className="min-w-0 space-y-2">
    <ModbusSemanticPointSelector {...props} />
    {showAdvanced && <details className="min-w-0 text-caption text-muted-foreground">
      <summary className="cursor-pointer py-2">{t('plc.semantic.advanced')}</summary>
      <ModbusAddressFields compact profileId={props.profile.id} symbol={props.value?.symbolicAddress ?? ''} symbolLabel={t('modbus.symbol')} optional disabled={props.disabled} capacities={props.capacities} onSymbol={symbol => {
        if (!symbol) { props.onChange(undefined); return; }
        try { props.onChange(plcPointAddress(props.profile, props.profile.resolve(symbol, props.capacities))); }
        catch { props.onChange({ profileId: props.profile.id, symbolicAddress: symbol, area: props.value?.area ?? 'coil', address: -1 }); }
      }} />
    </details>}
    {props.optional && props.value && <Button type="button" variant="ghost" onClick={() => props.onChange(undefined)}>{t('plc.semantic.clear_relation')}</Button>}
  </div>;
}
