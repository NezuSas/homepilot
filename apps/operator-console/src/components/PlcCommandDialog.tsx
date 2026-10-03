import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ModbusVariable, ModbusDiagnostic } from '../../../../packages/integrations/modbus/domain/Modbus';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../config';
import { Modal } from './ui/Modal';
import { NumberInput } from './ui/NumberInput';
import { SearchableSelectField } from './ui/SearchableSelectField';
import { Button } from './ui/Button';
import { AlertBanner } from './ui/AlertBanner';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { plcResponseError } from '../lib/plcUi';

/** Writes use the common device command route, never the read probe. */
export function PlcCommandDialog({ variable, onClose, onExecuted }: { variable: ModbusVariable & { diagnostic?: ModbusDiagnostic }; onClose: () => void; onExecuted: () => Promise<void> }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [command, setCommand] = useState('turn_on');
  const [value, setValue] = useState<number>(NaN);
  const setpoint = variable.plc?.role === 'setpoint', pulse = variable.plc?.mode === 'pulse';
  const actual = useDeviceSnapshotStore(state => state.devices.find(device => device.id === variable.deviceId)?.lastKnownState);
  const current = variable.diagnostic?.value ?? actual?.value;
  const unavailable = variable.diagnostic?.status !== undefined ? variable.diagnostic.status !== 'online' : actual?.available === false;
  const execute = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !variable.writable) return;
    setBusy(true); setError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/devices/${encodeURIComponent(variable.deviceId)}/command`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: setpoint ? { name: 'set_value', params: { value } } : pulse ? 'pulse' : command }) });
      if (!response.ok) { setError(t(await plcResponseError(response))); await onExecuted(); return; }
      await onExecuted(); onClose();
    } catch { setError(t('plc.command_failed')); } finally { setBusy(false); }
  };
  return <Modal isOpen onClose={() => { if (!busy) onClose(); }} title={t('plc.authorize_command')} description={variable.name} headerAlign="start" className="max-w-md">
    <form onSubmit={event => void execute(event)} className="space-y-3">
      <AlertBanner variant="warning" className="text-foreground [&_p]:opacity-100" message={t('plc.write_warning')} />
      {setpoint && <p className="text-body-compact tabular-nums">{t('plc.actual_state')}: {unavailable ? t('plc.unavailable') : current === undefined ? t('plc.awaiting') : `${current} ${variable.unit}`} · {variable.symbolicAddress}</p>}
      {pulse && <AlertBanner variant="warning" className="text-foreground [&_p]:opacity-100" message={t('plc.watchdog_warning')} />}
      {setpoint ? <NumberInput label={t('plc.setpoint_value')} value={value} onValueChange={setValue} onEmpty={() => setValue(NaN)} min={variable.plc?.min} max={variable.plc?.max} step="any" helperText={`${variable.plc?.min} – ${variable.plc?.max} ${variable.unit}`} /> : !pulse && <SearchableSelectField label={t('plc.command')} value={command} onChange={setCommand} options={[{ value: 'turn_on', label: t('plc.on') }, { value: 'turn_off', label: t('plc.off') }]} />}
      {error && <AlertBanner variant="danger" className="text-foreground [&_p]:opacity-100" role="alert" message={error} />}
      {setpoint && Number.isFinite(value) && <p className="text-body-compact tabular-nums">{t('plc.write_target', { name: variable.name, value, unit: variable.unit })}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="secondary" size="lg" disabled={busy} onClick={onClose}>{t('modbus.cancel')}</Button><Button type="submit" size="lg" isLoading={busy} disabled={setpoint && (!Number.isFinite(value) || value < (variable.plc?.min ?? Infinity) || value > (variable.plc?.max ?? -Infinity))}>{t('plc.confirm_write')}</Button></div>
    </form>
  </Modal>;
}
