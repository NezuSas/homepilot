import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { modbusAreas, modbusWordOrders, modbusRefreshIntervals } from '../lib/plcUi';
import { formatMeasurement } from '../lib/formatMeasurement';
import { modbusRegisterTypes, modbusWordCount, type ModbusArea, type ModbusConnection, type ModbusProbeResult, type ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { presentProbeRows } from '../lib/modbusProbePresentation';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../config';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { NumberInput } from './ui/NumberInput';
import { MeasurementUnitSelect } from './ui/MeasurementUnitSelect';
import { Button } from './ui/Button';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { AlertBanner } from './ui/AlertBanner';
import { LoadingState } from './ui/LoadingState';
import { DashboardSkeletonBar as Bar } from './ui/DashboardCardSkeleton';
import { resolveModbusRange, modbusAddressProfiles, type ModbusModuleCapacities } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { ModbusAddressFields, ModbusModuleCapacityFields, ModbusProfileSelect } from './ModbusAddressFields';

export type ModbusProbeSelection = { connection: Omit<ModbusConnection, 'id' | 'homeId'>; variable: Omit<ModbusVariable, 'deviceId' | 'connectionId'> };
/** Operate extension: explicit read-only range, RAW beside conversion, one confirmed mapping at a time.
 * Inherits HomePilot tokens and controls; mobile wraps fields and scrolls only the measurement table.
 */
export function ModbusReadProbe({ homeId, initial, onClose, onCreate }: {
  homeId: string; initial?: ModbusConnection; onClose: () => void; onCreate: (selection: ModbusProbeSelection) => Promise<void>;
}) {
  const { t } = useTranslation();
  const tableHintId = useId();
  const [profileId, setProfileId] = useState(initial?.profileId ?? ''), [symbol, setSymbol] = useState('D100'), [symbolEnd, setSymbolEnd] = useState('D120');
  const [capacities, setCapacities] = useState<ModbusModuleCapacities>(initial?.moduleCapacities ?? {});
  let addresses: ReturnType<typeof resolveModbusRange> | undefined;
  try { if (profileId) addresses = resolveModbusRange(profileId, symbol, symbolEnd, capacities); } catch { /* Invalid symbols never become stale resolutions. */ }
  const [host, setHost] = useState(initial?.host ?? ''), [unitId, setUnitId] = useState(initial?.unitId ?? 1);
  const [area, setArea] = useState<ModbusArea>('holding_register');
  const [start, setStart] = useState(100), [end, setEnd] = useState(120), [timeoutMs, setTimeoutMs] = useState(2000);
  const [refreshMs, setRefreshMs] = useState(0), [running, setRunning] = useState(false), [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<ModbusProbeResult | null>(null);
  const [hasAttemptedRead, setHasAttemptedRead] = useState(false);
  const [rowFilter, setRowFilter] = useState('all');
  const [dataType, setDataType] = useState<ModbusVariable['dataType']>('uint16');
  const [scale, setScale] = useState(1), [offset, setOffset] = useState(0), [unit, setUnit] = useState('');
  const [wordOrder, setWordOrder] = useState<ModbusVariable['wordOrder']>('high_first');
  const active = useRef<AbortController | null>(null);
  const effectiveArea = addresses?.[0].area ?? area;
  const effectiveStart = addresses?.[0].address ?? start, effectiveEnd = addresses?.[addresses.length - 1].address ?? end;
  const bit = effectiveArea === 'coil' || effectiveArea === 'discrete_input';
  const capacityJson = JSON.stringify(capacities);
  const conversion = { dataType: bit ? 'boolean' as const : dataType === 'boolean' ? 'uint16' as const : dataType, scale: bit ? 1 : scale, offset: bit ? 0 : offset, wordOrder };
  const displayedRows = result ? presentProbeRows(result.rows, conversion, rowFilter) : [];
  const stop = () => { active.current?.abort(); setRunning(false); setBusy(false); };
  const close = () => { if (creating) return; stop(); onClose(); };
  const reset = () => { setResult(null); setError(''); setHasAttemptedRead(false); };
  useEffect(() => {
    if (!running) return;
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const controller = new AbortController(); active.current = controller; setBusy(true);
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/probe`, { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeId, host, unitId, area: effectiveArea, start: effectiveStart, end: effectiveEnd, timeoutMs, ...(profileId ? { profileId, symbolicStart: symbol, symbolicEnd: symbolEnd, moduleCapacities: JSON.parse(capacityJson) } : {}) }) });
        if (!response.ok) throw new Error();
        const next: ModbusProbeResult = await response.json();
        if (!disposed && !controller.signal.aborted) {
          setResult(previous => ({ ...next, rows: next.rows.map(row => row.status === 'error' ? { ...row, raw: previous?.rows.find(old => old.address === row.address)?.raw ?? null } : row) }));
          setError('');
        }
      } catch { if (!disposed && !controller.signal.aborted) { setError(t('modbus.probe_failed')); setResult(previous => previous ? { ...previous, rows: previous.rows.map(row => ({ ...row, status: 'error', error: 'CONNECTION', elapsedMs: null, exceptionCode: undefined })) } : null); } }
      finally {
        if (!disposed && !controller.signal.aborted) { setBusy(false); if (refreshMs) timer = setTimeout(() => void read(), refreshMs); else setRunning(false); }
      }
    };
    void read();
    return () => { disposed = true; clearTimeout(timer); active.current?.abort(); };
  }, [running, homeId, host, unitId, effectiveArea, effectiveStart, effectiveEnd, timeoutMs, refreshMs, profileId, symbol, symbolEnd, capacityJson, t]);
  const create = async (address: number) => {
    stop(); setCreating(true); setError('');
    const resolved = addresses?.find(item => item.address === address);
    try { await onCreate({ connection: { name: initial?.name ?? `PLC ${host}`, host, port: 502, unitId, timeoutMs, pollIntervalMs: 5000, enabled: false, ...(profileId ? { profileId, moduleCapacities: capacities } : {}) },
      variable: { name: resolved?.symbolicAddress ?? `${t(`modbus.${effectiveArea}`)} ${address}`, area: effectiveArea, address, ...conversion, unit: bit ? '' : unit, writable: false, ...(resolved ? { profileId, symbolicAddress: resolved.symbolicAddress } : {}) } }); }
    catch { setError(t('modbus.save_error')); } finally { setCreating(false); }
  };
  return <Modal isOpen onClose={close} title={t('modbus.probe_title')} description={t('modbus.probe_hint')} headerAlign="start" className="max-w-5xl text-card-foreground" bodyClassName="overflow-x-hidden overscroll-contain" layerClassName="overflow-hidden">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!profileId || addresses) { setHasAttemptedRead(true); setRunning(true); } }}>
      <fieldset disabled={running || creating} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-full"><ModbusProfileSelect value={profileId} disabled={running || creating} onChange={value => { setProfileId(value); reset(); setDataType('uint16'); }} /></div>
        <Input label={t('modbus.host')} value={host} required placeholder="192.168.1.5" onChange={e => { setHost(e.target.value); reset(); }} />
        <NumberInput label={t('modbus.unitId')} min={1} max={247} value={unitId} onValueChange={value => { setUnitId(value); reset(); }} onEmpty={() => { setUnitId(NaN); reset(); }} />
        {!profileId && <SearchableSelectField label={t('modbus.area')} disabled={running || creating} value={area} options={modbusAreas.map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => { setArea(value as ModbusArea); reset(); }} />}
        <NumberInput label={t('modbus.timeoutMs')} min={250} max={5000} value={timeoutMs} onValueChange={value => { setTimeoutMs(value); reset(); }} onEmpty={() => { setTimeoutMs(NaN); reset(); }} />
        {profileId ? <ModbusAddressFields profileId={profileId} symbol={symbol} end={symbolEnd} capacities={capacities} disabled={running || creating} onSymbol={value => { setSymbol(value); reset(); }} onEnd={value => { setSymbolEnd(value); reset(); }} /> : <>
          <NumberInput label={t('modbus.range_start')} min={0} max={65535} value={start} onValueChange={value => { setStart(value); reset(); }} onEmpty={() => { setStart(NaN); reset(); }} />
          <NumberInput label={t('modbus.range_end')} min={Number.isFinite(start) ? start : 0} max={Number.isFinite(start) ? Math.min(65535, start + 63) : 65535} value={end} onValueChange={value => { setEnd(value); reset(); }} onEmpty={() => { setEnd(NaN); reset(); }} />
        </>}
        {modbusAddressProfiles.find(profile => profile.id === profileId)?.segments.some(segment => segment.module) && <ModbusModuleCapacityFields profileId={profileId} capacities={capacities} disabled={running || creating} onChange={value => { setCapacities(value); reset(); }} />}
        <SearchableSelectField label={t('modbus.refresh')} disabled={running || creating} value={String(refreshMs)} options={[{ value: '0', label: t('modbus.manual') }, ...modbusRefreshIntervals.map(value => ({ value: String(value), label: `${value / 1000} s` }))]} onChange={value => setRefreshMs(Number(value))} />
      </fieldset>
      <p className="text-caption text-muted-foreground">{t('modbus.range_hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={running || creating || !homeId || (!!profileId && !addresses)}>{t('modbus.probe_start')}</Button>
        {running && <Button type="button" variant="secondary" size="lg" onClick={stop}>{t('modbus.probe_stop')}</Button>}
        <span role="status" className="text-caption text-muted-foreground">{t(busy ? 'modbus.reading' : running ? 'modbus.waiting' : hasAttemptedRead ? 'modbus.stopped' : 'modbus.not_started')}</span>
      </div>
    </form>
    {error && <AlertBanner variant="danger" role="alert" message={error} />}
    <div className="my-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
      {modbusWordCount(conversion.dataType) === 2 && <p className="text-caption text-muted-foreground sm:col-span-2 lg:col-span-full">{t('modbus.two_words')}</p>}
      <SearchableSelectField label={t('modbus.dataType')} value={conversion.dataType} options={(bit ? ['boolean'] : modbusRegisterTypes).map(value => ({ value, label: value }))} onChange={value => setDataType(value as ModbusVariable['dataType'])} />
      {!bit && <>
        <NumberInput label={t('modbus.scale')} step="any" value={scale} onValueChange={setScale} onEmpty={() => setScale(NaN)} />
        <NumberInput label={t('modbus.offset')} step="any" value={offset} onValueChange={setOffset} onEmpty={() => setOffset(NaN)} />
        <MeasurementUnitSelect label={t('modbus.unit')} value={unit} onChange={setUnit} />
        {modbusWordCount(dataType) === 2 && <SearchableSelectField label={t('modbus.wordOrder')} value={wordOrder} options={modbusWordOrders.map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => setWordOrder(value as ModbusVariable['wordOrder'])} />}
      </>}
    </div>
    {busy && !result && <LoadingState label={t('modbus.reading')}><ModbusProbeTableSkeleton /></LoadingState>}
    {result && <>
      <div className="mb-3 w-full sm:max-w-xs"><SearchableSelectField label={t('modbus.result_filter')} value={rowFilter}
        options={['all', 'valid', 'active'].map(value => ({ value, label: t(`modbus.filter_${value}`) }))} onChange={setRowFilter} /></div>
      <p className="mb-2 text-caption text-muted-foreground">{t('modbus.sampled_at', { time: new Date(result.sampledAt).toLocaleTimeString() })}</p>
      <p id={tableHintId} className="mb-2 text-caption text-muted-foreground">{t('modbus.table_scroll_hint')}</p>
      <p aria-live="polite" className="mb-2 text-caption text-muted-foreground">{t('modbus.filtered_count', { count: displayedRows.length, total: result.rows.length })}</p>
      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border">
      <div className="relative isolate max-h-80 min-w-0 max-w-full overflow-auto overscroll-contain" tabIndex={0} role="region" aria-label={t('modbus.probe_results')} aria-describedby={tableHintId}>
        <table className="w-full border-separate border-spacing-0 text-left text-caption tabular-nums">
          <caption className="sr-only">{t('modbus.probe_results')}</caption>
          <thead><tr>{[...(profileId ? ['symbol', 'area'] : []), 'pdu', 'raw', 'dataType', 'converted', ...(profileId ? ['unit'] : []), 'read_status', 'response_time', 'read_error', 'variable'].map(key => <th key={key} scope="col" className="sticky top-0 z-10 whitespace-nowrap border-b border-border bg-card p-3 font-semibold">{t(`modbus.${key}`)}</th>)}</tr></thead>
          <tbody>{displayedRows.map(({ row, value }) => {
            return <tr key={row.address} className="border-t border-border">
              {profileId && <><td className="whitespace-nowrap p-3">{addresses?.find(item => item.address === row.address)?.symbolicAddress ?? '—'}</td><td className="whitespace-nowrap p-3">{t(`modbus.${effectiveArea}`)}</td></>}
              <th scope="row" className="p-3">{row.address}</th><td className="whitespace-nowrap p-3">{row.raw === null ? '—' : String(row.raw)}{row.status === 'error' && row.raw !== null && <span className="ml-2 text-muted-foreground">{t('modbus.previous')}</span>}</td>
              <td className="p-3">{conversion.dataType}</td><td className="whitespace-nowrap p-3">{value === null ? '—' : typeof value === 'boolean' ? t(value ? 'modbus.input_active' : 'modbus.input_inactive') : formatMeasurement(value)} {value !== null && !bit && !profileId ? unit : ''}</td>
              {profileId && <td className="p-3">{!bit && unit ? unit : '—'}</td>}
              <td className="whitespace-nowrap p-3">{t(row.status === 'ok' ? 'modbus.read_ok' : 'modbus.read_failed')}</td><td className="whitespace-nowrap p-3">{row.elapsedMs === null ? '—' : `${row.elapsedMs} ms`}</td>
              <td className="min-w-40 p-3">{row.exceptionCode !== undefined ? t('modbus.exception', { code: row.exceptionCode }) : row.error ? t(`modbus.errors.${row.error}`, { defaultValue: t('modbus.probe_failed') }) : value === null ? t('modbus.conversion_error') : '—'}</td>
              <td className="whitespace-nowrap p-3"><Button className="whitespace-nowrap" variant="outline" size="lg" disabled={value === null || row.status !== 'ok' || creating} onClick={() => void create(row.address)}>{t('modbus.create_variable')}</Button></td>
            </tr>;
          })}{!displayedRows.length && <tr><td colSpan={profileId ? 11 : 8} className="p-4 text-muted-foreground">{t('common.no_results')}</td></tr>}</tbody>
        </table>
      </div>
      </div>
    </>}
  </Modal>;
}
export function ModbusProbeTableSkeleton() {
  return <div aria-hidden="true" className="space-y-3 rounded-xl border border-border p-3"><Bar className="h-5 w-full" />{[0, 1, 2].map(row => <Bar key={row} className="h-11 w-full" />)}</div>;
}
