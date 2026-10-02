import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertModbusValue, modbusRegisterTypes, modbusWordCount, type ModbusArea, type ModbusConnection, type ModbusProbeResult, type ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../config';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { AlertBanner } from './ui/AlertBanner';
import { LoadingState } from './ui/LoadingState';
import { DashboardSkeletonBar as Bar } from './ui/DashboardCardSkeleton';

export type ModbusProbeSelection = { connection: Omit<ModbusConnection, 'id' | 'homeId'>; variable: Omit<ModbusVariable, 'deviceId' | 'connectionId'> };
/** Operate extension: explicit read-only range, RAW beside conversion, one confirmed mapping at a time.
 * Inherits HomePilot tokens and controls; mobile wraps fields and scrolls only the measurement table.
 */
export function ModbusReadProbe({ homeId, initial, onClose, onCreate }: {
  homeId: string; initial?: ModbusConnection; onClose: () => void; onCreate: (selection: ModbusProbeSelection) => Promise<void>;
}) {
  const { t } = useTranslation();
  const tableHintId = useId();
  const [host, setHost] = useState(initial?.host ?? ''), [unitId, setUnitId] = useState(initial?.unitId ?? 1);
  const [area, setArea] = useState<ModbusArea>('holding_register');
  const [start, setStart] = useState(100), [end, setEnd] = useState(120), [timeoutMs, setTimeoutMs] = useState(2000);
  const [refreshMs, setRefreshMs] = useState(0), [running, setRunning] = useState(false), [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false), [error, setError] = useState('');
  const [result, setResult] = useState<ModbusProbeResult | null>(null);
  const [dataType, setDataType] = useState<ModbusVariable['dataType']>('uint16');
  const [scale, setScale] = useState(1), [offset, setOffset] = useState(0), [unit, setUnit] = useState('');
  const [wordOrder, setWordOrder] = useState<ModbusVariable['wordOrder']>('high_first');
  const active = useRef<AbortController | null>(null);
  const bit = area === 'coil' || area === 'discrete_input';
  const conversion = { dataType: bit ? 'boolean' as const : dataType, scale: bit ? 1 : scale, offset: bit ? 0 : offset, wordOrder };
  const stop = () => { active.current?.abort(); setRunning(false); setBusy(false); };
  const close = () => { if (creating) return; stop(); onClose(); };
  const reset = () => { setResult(null); setError(''); };
  useEffect(() => {
    if (!running) return;
    let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      const controller = new AbortController(); active.current = controller; setBusy(true);
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/probe`, { method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ homeId, host, unitId, area, start, end, timeoutMs }) });
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
  }, [running, homeId, host, unitId, area, start, end, timeoutMs, refreshMs, t]);
  const create = async (address: number) => {
    stop(); setCreating(true); setError('');
    try { await onCreate({ connection: { name: initial?.name ?? `PLC ${host}`, host, port: 502, unitId, timeoutMs, pollIntervalMs: 5000, enabled: false },
      variable: { name: `${t(`modbus.${area}`)} ${address}`, area, address, ...conversion, unit: bit ? '' : unit, writable: false } }); }
    catch { setError(t('modbus.save_error')); } finally { setCreating(false); }
  };
  return <Modal isOpen onClose={close} title={t('modbus.probe_title')} description={t('modbus.probe_hint')} headerAlign="start" className="max-w-5xl text-card-foreground">
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); setRunning(true); }}>
      <fieldset disabled={running || creating} className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label={t('modbus.host')} value={host} required placeholder="192.168.1.5" onChange={e => { setHost(e.target.value); reset(); }} />
        <Input label={t('modbus.unitId')} type="number" min={1} max={247} required value={unitId} onChange={e => { setUnitId(Number(e.target.value)); reset(); }} />
        <SearchableSelectField label={t('modbus.area')} disabled={running || creating} value={area} options={(['coil', 'discrete_input', 'holding_register', 'input_register'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => { setArea(value as ModbusArea); reset(); }} />
        <Input label={t('modbus.timeoutMs')} type="number" min={250} max={5000} value={timeoutMs} required onChange={e => { setTimeoutMs(Number(e.target.value)); reset(); }} />
        <Input label={t('modbus.range_start')} type="number" min={0} max={65535} value={start} required onChange={e => { setStart(Number(e.target.value)); reset(); }} />
        <Input label={t('modbus.range_end')} type="number" min={start} max={Math.min(65535, start + 63)} value={end} required onChange={e => { setEnd(Number(e.target.value)); reset(); }} />
        <SearchableSelectField label={t('modbus.refresh')} disabled={running || creating} value={String(refreshMs)} options={[{ value: '0', label: t('modbus.manual') }, ...[1000, 5000, 10000, 30000, 60000].map(value => ({ value: String(value), label: `${value / 1000} s` }))]} onChange={value => setRefreshMs(Number(value))} />
      </fieldset>
      <p className="text-caption text-muted-foreground">{t('modbus.range_hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={running || creating || !homeId}>{t('modbus.probe_start')}</Button>
        {running && <Button type="button" variant="secondary" size="lg" onClick={stop}>{t('modbus.probe_stop')}</Button>}
        <span role="status" className="text-caption text-muted-foreground">{t(busy ? 'modbus.reading' : running ? 'modbus.waiting' : 'modbus.stopped')}</span>
      </div>
    </form>
    {error && <AlertBanner variant="danger" role="alert" message={error} />}
    <div className="my-4 grid min-w-0 gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
      <SearchableSelectField label={t('modbus.dataType')} value={conversion.dataType} options={(bit ? ['boolean'] : modbusRegisterTypes).map(value => ({ value, label: value }))} onChange={value => setDataType(value as ModbusVariable['dataType'])} />
      {!bit && <>
        <Input label={t('modbus.scale')} type="number" step="any" value={scale} onChange={e => setScale(Number(e.target.value))} />
        <Input label={t('modbus.offset')} type="number" step="any" value={offset} onChange={e => setOffset(Number(e.target.value))} />
        <Input label={t('modbus.unit')} maxLength={24} value={unit} onChange={e => setUnit(e.target.value)} />
        {modbusWordCount(dataType) === 2 && <SearchableSelectField label={t('modbus.wordOrder')} value={wordOrder} options={(['high_first', 'low_first'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => setWordOrder(value as ModbusVariable['wordOrder'])} />}
      </>}
    </div>
    {busy && !result && <LoadingState label={t('modbus.reading')}><ModbusProbeTableSkeleton /></LoadingState>}
    {result && <>
      <p className="mb-2 text-caption text-muted-foreground">{t('modbus.sampled_at', { time: new Date(result.sampledAt).toLocaleTimeString() })}</p>
      <p id={tableHintId} className="mb-2 text-caption text-muted-foreground">{t('modbus.table_scroll_hint')}</p>
      <div className="max-h-80 overflow-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label={t('modbus.probe_results')} aria-describedby={tableHintId}>
        <table className="w-full text-left text-caption tabular-nums">
          <caption className="sr-only">{t('modbus.probe_results')}</caption>
          <thead className="sticky top-0 bg-card"><tr>{['pdu', 'raw', 'dataType', 'converted', 'read_status', 'response_time', 'read_error', 'variable'].map(key => <th key={key} scope="col" className="whitespace-nowrap p-3 font-semibold">{t(`modbus.${key}`)}</th>)}</tr></thead>
          <tbody>{result.rows.map((row, index) => {
            let value: number | boolean | null = null;
            try { const words = result.rows.slice(index, index + modbusWordCount(conversion.dataType)); if (words.some(word => word.status !== 'ok' || word.raw === null) || !Number.isFinite(scale) || scale === 0 || !Number.isFinite(offset)) throw new Error(); value = convertModbusValue(words.map(word => word.raw!), conversion); } catch { /* Missing/invalid words never become a fabricated preview. */ }
            return <tr key={row.address} className="border-t border-border">
              <th scope="row" className="p-3">{row.address}</th><td className="whitespace-nowrap p-3">{row.raw === null ? '—' : String(row.raw)}{row.status === 'error' && row.raw !== null && <span className="ml-2 text-muted-foreground">{t('modbus.previous')}</span>}</td>
              <td className="p-3">{conversion.dataType}</td><td className="whitespace-nowrap p-3">{value === null ? '—' : typeof value === 'boolean' ? String(value) : new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(value)} {value !== null && !bit ? unit : ''}</td>
              <td className="whitespace-nowrap p-3">{t(row.status === 'ok' ? 'modbus.read_ok' : 'modbus.read_failed')}</td><td className="whitespace-nowrap p-3">{row.elapsedMs === null ? '—' : `${row.elapsedMs} ms`}</td>
              <td className="min-w-40 p-3">{row.exceptionCode !== undefined ? t('modbus.exception', { code: row.exceptionCode }) : row.error ? t(`modbus.errors.${row.error}`, { defaultValue: t('modbus.probe_failed') }) : value === null ? t('modbus.conversion_error') : '—'}</td>
              <td className="p-3"><Button variant="outline" size="lg" disabled={value === null || row.status !== 'ok' || creating} onClick={() => void create(row.address)}>{t('modbus.create_variable')}</Button></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>}
  </Modal>;
}
export function ModbusProbeTableSkeleton() {
  return <div aria-hidden="true" className="space-y-3 rounded-xl border border-border p-3"><Bar className="h-5 w-full" />{[0, 1, 2].map(row => <Bar key={row} className="h-11 w-full" />)}</div>;
}
