import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Cable, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { modbusRegisterTypes, modbusWordCount, type ModbusConnection, type ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { ModbusReadProbe, type ModbusProbeSelection } from '../components/ModbusReadProbe';
import { ModbusConnectionCard, ModbusSettingsSkeleton, type ModbusConnectionSummary } from '../components/ModbusConnectionCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';
import { SearchableSelectField } from '../components/ui/SearchableSelectField';
import { Modal } from '../components/ui/Modal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { apiFetch } from '../lib/apiClient';
import { API_BASE_URL } from '../config';

const connectionDefaults: Omit<ModbusConnection, 'id' | 'homeId'> = { name: '', host: '', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: false };
const variableDefaults: Omit<ModbusVariable, 'deviceId' | 'connectionId'> = { name: '', area: 'holding_register', address: 0, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, unit: '', writable: false };
type Editor = { kind: 'connection'; id?: string } | { kind: 'variable'; connectionId: string; deviceId?: string };

/** Operate: compact configuration, explicit map and safe opt-in; inherited HomePilot palette/controls. */
export function ModbusView() {
  const { t } = useTranslation();
  const homeId = useDeviceSnapshotStore(s => s.homes[0]?.id ?? '');
  const refresh = useDeviceSnapshotStore(s => s.refreshSnapshot);
  const [connections, setConnections] = useState<ModbusConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [formError, setFormError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [probe, setProbe] = useState(false);
  const [connectionForm, setConnectionForm] = useState(connectionDefaults);
  const [variableForm, setVariableForm] = useState(variableDefaults);
  const load = useCallback(async () => {
    if (!homeId) return;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/connections?homeId=${encodeURIComponent(homeId)}`);
      if (!response.ok) throw new Error();
      const data: { connections: ModbusConnectionSummary[] } = await response.json();
      setConnections(data.connections); setError('');
    } catch { setError(t('modbus.load_error')); } finally { setLoading(false); }
  }, [homeId, t]);
  useEffect(() => { void refresh().finally(() => { if (!useDeviceSnapshotStore.getState().homes.length) setLoading(false); }); }, [refresh]);
  useEffect(() => { void load(); }, [load]);
  const openConnection = (connection?: ModbusConnection) => {
    setConnectionForm(connection ?? { ...connectionDefaults }); setFormError(''); setEditor({ kind: 'connection', id: connection?.id });
  };
  const openVariable = (connectionId: string, variable?: ModbusVariable) => {
    setVariableForm(variable ?? { ...variableDefaults }); setFormError(''); setEditor({ kind: 'variable', connectionId, deviceId: variable?.deviceId });
  };
  const close = () => { if (!busy) setEditor(null); };
  const createFromProbe = async ({ connection, variable }: ModbusProbeSelection) => {
    let saved = connections.find(item => item.host === connection.host && item.unitId === connection.unitId);
    if (!saved) {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/connections`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...connection, homeId, enabled: false }) });
      if (!response.ok) throw new Error();
      const data: { connection: ModbusConnectionSummary } = await response.json(); saved = data.connection;
      await load();
    }
    setProbe(false); setVariableForm(variable); setFormError(''); setEditor({ kind: 'variable', connectionId: saved.id });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!editor) return;
    setBusy(true); setFormError('');
    const path = editor.kind === 'connection' ? `connections${editor.id ? `/${editor.id}` : ''}`
      : `connections/${editor.connectionId}/variables${editor.deviceId ? `/${editor.deviceId}` : ''}`;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/${path}`, { method: (editor.kind === 'connection' ? editor.id : editor.deviceId) ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor.kind === 'connection' ? { ...connectionForm, homeId } : variableForm) });
      if (!response.ok) throw new Error();
      setEditor(null); await load(); await refresh();
    } catch { setFormError(t('modbus.save_error')); } finally { setBusy(false); }
  };
  if (loading) return <ModbusSettingsSkeleton label={t('common.loading')} />;
  return <div className="min-w-0 space-y-4">
    <SectionHeader level="view" title={t('modbus.title')} subtitle={t('modbus.subtitle')} icon={Cable}
      action={<div className="flex flex-wrap gap-2"><Button variant="outline" size="lg" disabled={!homeId} onClick={() => setProbe(true)}>{t('modbus.probe_title')}</Button><Button size="lg" disabled={!homeId} onClick={() => openConnection()}><Plus aria-hidden="true" className="size-4" />{t('modbus.add_connection')}</Button></div>} />
    {error && <AlertBanner variant="danger" message={error} action={<Button variant="outline" onClick={() => void load()}>{t('modbus.retry')}</Button>} />}
    {!error && !connections.length && <EmptyState icon={Cable} title={t('modbus.empty')} description={t('modbus.empty_hint')} />}
    <div className="grid items-start gap-4 lg:grid-cols-2">{connections.map(connection => <ModbusConnectionCard key={connection.id} connection={connection} onEdit={() => openConnection(connection)} onAdd={() => openVariable(connection.id)} onVariable={variable => openVariable(connection.id, variable)} />)}</div>
    {probe && <ModbusReadProbe homeId={homeId} onClose={() => setProbe(false)} onCreate={createFromProbe} />}
    <Modal isOpen={editor !== null} onClose={close} title={t(editor?.kind === 'variable' ? 'modbus.variable_title' : 'modbus.connection_title')} description={t('modbus.safe_hint')} className="max-w-xl text-card-foreground" headerAlign="start">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {formError && <div className="sm:col-span-2"><AlertBanner role="alert" variant="danger" message={formError} /></div>}
        {editor?.kind === 'connection' ? <>
          <Input label={t('modbus.name')} value={connectionForm.name} maxLength={80} required onChange={e => setConnectionForm({ ...connectionForm, name: e.target.value })} />
          <Input label={t('modbus.host')} placeholder="192.168.1.5" value={connectionForm.host} required onChange={e => setConnectionForm({ ...connectionForm, host: e.target.value })} />
          <Input label={t('modbus.unitId')} type="number" min={1} max={247} value={connectionForm.unitId} required onChange={e => setConnectionForm({ ...connectionForm, unitId: Number(e.target.value) })} />
          <Input label={t('modbus.port')} value={502} readOnly />
          <Input label={t('modbus.timeoutMs')} type="number" min={250} max={10000} value={connectionForm.timeoutMs} required onChange={e => setConnectionForm({ ...connectionForm, timeoutMs: Number(e.target.value) })} />
          <Input label={t('modbus.pollIntervalMs')} type="number" min={1000} max={60000} value={connectionForm.pollIntervalMs} required onChange={e => setConnectionForm({ ...connectionForm, pollIntervalMs: Number(e.target.value) })} />
          <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-body-compact">{t('modbus.enable_polling')}</span><ToggleSwitch label={t('modbus.enable_polling')} checked={connectionForm.enabled} onCheckedChange={enabled => setConnectionForm({ ...connectionForm, enabled })} /></div>
        </> : <>
          <Input label={t('modbus.name')} value={variableForm.name} maxLength={80} required onChange={e => setVariableForm({ ...variableForm, name: e.target.value })} />
          <Input label={t('modbus.address')} helperText={t('modbus.address_hint')} type="number" min={0} max={65536 - modbusWordCount(variableForm.dataType)} required value={variableForm.address} onChange={e => setVariableForm({ ...variableForm, address: Number(e.target.value) })} />
          <SearchableSelectField label={t('modbus.area')} value={variableForm.area} options={(['coil', 'discrete_input', 'holding_register', 'input_register'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => { const area = value as ModbusVariable['area']; setVariableForm({ ...variableForm, area, dataType: area === 'coil' || area === 'discrete_input' ? 'boolean' : 'uint16', writable: false, scale: 1, offset: 0 }); }} />
          <SearchableSelectField label={t('modbus.dataType')} value={variableForm.dataType} options={(variableForm.area === 'coil' || variableForm.area === 'discrete_input' ? ['boolean'] : modbusRegisterTypes).map(value => ({ value, label: value }))} onChange={value => setVariableForm({ ...variableForm, dataType: value as ModbusVariable['dataType'] })} />
          {variableForm.dataType !== 'boolean' && <>
            <Input label={t('modbus.scale')} type="number" step="any" required value={variableForm.scale} onChange={e => setVariableForm({ ...variableForm, scale: Number(e.target.value) })} />
            <Input label={t('modbus.offset')} type="number" step="any" required value={variableForm.offset} onChange={e => setVariableForm({ ...variableForm, offset: Number(e.target.value) })} />
            <Input label={t('modbus.unit')} maxLength={24} value={variableForm.unit} onChange={e => setVariableForm({ ...variableForm, unit: e.target.value })} />
          </>}
          {modbusWordCount(variableForm.dataType) === 2 && <SearchableSelectField label={t('modbus.wordOrder')} value={variableForm.wordOrder} options={(['high_first', 'low_first'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => setVariableForm({ ...variableForm, wordOrder: value as ModbusVariable['wordOrder'] })} />}
          {variableForm.area === 'coil' && <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-body-compact">{t('modbus.allow_write')}</span><ToggleSwitch label={t('modbus.allow_write')} checked={variableForm.writable} onCheckedChange={writable => setVariableForm({ ...variableForm, writable })} /></div>}
          <p className="text-caption text-muted-foreground sm:col-span-2">{t('modbus.assignment_hint')}</p>
        </>}
        <div className="flex justify-end gap-2 border-t border-border pt-3 sm:col-span-2"><Button variant="secondary" type="button" size="lg" disabled={busy} onClick={close}>{t('modbus.cancel')}</Button><Button type="submit" size="lg" isLoading={busy}>{t('modbus.save')}</Button></div>
      </form>
    </Modal>
  </div>;
}
