import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Cable, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { modbusRegisterTypes, modbusWordCount, type ModbusConnection, type ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import { ModbusReadProbe, type ModbusProbeSelection } from '../components/ModbusReadProbe';
import { ModbusAddressFields, ModbusModuleCapacityFields, ModbusProfileSelect } from '../components/ModbusAddressFields';
import { resolveModbusAddress } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { ModbusConnectionCard, ModbusSettingsSkeleton, type ModbusConnectionSummary } from '../components/ModbusConnectionCard';
import { SectionHeader } from '../components/ui/SectionHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NumberInput } from '../components/ui/NumberInput';
import { MeasurementUnitSelect } from '../components/ui/MeasurementUnitSelect';
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [probe, setProbe] = useState(false);
  const [connectionForm, setConnectionForm] = useState(connectionDefaults);
  const [variableForm, setVariableForm] = useState(variableDefaults);
  let canWrite = variableForm.area === 'coil';
  if (variableForm.profileId) {
    try { canWrite = resolveModbusAddress(variableForm.profileId, variableForm.symbolicAddress ?? '').segment.writable; }
    catch { canWrite = false; }
  }
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
    const profileId = connections.find(item => item.id === connectionId)?.profileId;
    setVariableForm(variable ?? { ...variableDefaults, ...(profileId ? { profileId, symbolicAddress: 'D0' } : {}) }); setFormError(''); setEditor({ kind: 'variable', connectionId, deviceId: variable?.deviceId });
  };
  const close = () => { if (!busy) setEditor(null); };
  const remove = async () => {
    if (!editor || busy) return;
    const path = editor.kind === 'connection' ? `connections/${editor.id}` : `connections/${editor.connectionId}/variables/${editor.deviceId}`;
    setBusy(true); setFormError('');
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/${path}`, { method: 'DELETE' });
      if (!response.ok) {
        setFormError(t(response.status === 409 ? editor.kind === 'connection' ? 'modbus.connection_in_use' : 'modbus.variable_in_use' : 'modbus.delete_error'));
        return;
      }
      setConfirmDelete(false); setEditor(null); await load(); await refresh();
    } catch { setFormError(t('modbus.delete_error')); } finally { setBusy(false); }
  };
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
    let configuredVariable = variableForm;
    if (editor.kind === 'variable' && variableForm.profileId) {
      try { const resolved = resolveModbusAddress(variableForm.profileId, variableForm.symbolicAddress ?? '', connections.find(item => item.id === editor.connectionId)?.moduleCapacities); configuredVariable = { ...variableForm, area: resolved.area, address: resolved.address }; }
      catch { setFormError(t('modbus.invalid_symbol')); setBusy(false); return; }
    }
    const path = editor.kind === 'connection' ? `connections${editor.id ? `/${editor.id}` : ''}`
      : `connections/${editor.connectionId}/variables${editor.deviceId ? `/${editor.deviceId}` : ''}`;
    try {
      const response = await apiFetch(`${API_BASE_URL}/api/v1/modbus/${path}`, { method: (editor.kind === 'connection' ? editor.id : editor.deviceId) ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editor.kind === 'connection' ? { ...connectionForm, homeId } : { ...configuredVariable, profileId: configuredVariable.profileId ?? null, symbolicAddress: configuredVariable.symbolicAddress ?? null }) });
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
    <Modal isOpen={editor !== null && !confirmDelete} onClose={close} title={t(editor?.kind === 'variable' ? 'modbus.variable_title' : 'modbus.connection_title')} description={t('modbus.safe_hint')} className="max-w-xl text-card-foreground" headerAlign="start">
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        {formError && <div className="sm:col-span-2"><AlertBanner role="alert" variant="danger" message={formError} /></div>}
        {editor?.kind === 'connection' ? <>
          <Input label={t('modbus.name')} value={connectionForm.name} maxLength={80} required onChange={e => setConnectionForm({ ...connectionForm, name: e.target.value })} />
          <ModbusProfileSelect value={connectionForm.profileId} onChange={profileId => setConnectionForm({ ...connectionForm, profileId, moduleCapacities: profileId ? connectionForm.moduleCapacities : undefined })} />
          {connectionForm.profileId && <ModbusModuleCapacityFields capacities={connectionForm.moduleCapacities} onChange={moduleCapacities => setConnectionForm({ ...connectionForm, moduleCapacities })} />}
          <Input label={t('modbus.host')} placeholder="192.168.1.5" value={connectionForm.host} required onChange={e => setConnectionForm({ ...connectionForm, host: e.target.value })} />
          <NumberInput label={t('modbus.unitId')} min={1} max={247} value={connectionForm.unitId} onValueChange={unitId => setConnectionForm({ ...connectionForm, unitId })} onEmpty={() => setConnectionForm({ ...connectionForm, unitId: NaN })} />
          <Input label={t('modbus.port')} value={502} readOnly />
          <NumberInput label={t('modbus.timeoutMs')} min={250} max={10000} value={connectionForm.timeoutMs} onValueChange={timeoutMs => setConnectionForm({ ...connectionForm, timeoutMs })} onEmpty={() => setConnectionForm({ ...connectionForm, timeoutMs: NaN })} />
          <NumberInput label={t('modbus.pollIntervalMs')} min={1000} max={60000} value={connectionForm.pollIntervalMs} onValueChange={pollIntervalMs => setConnectionForm({ ...connectionForm, pollIntervalMs })} onEmpty={() => setConnectionForm({ ...connectionForm, pollIntervalMs: NaN })} />
          <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-body-compact">{t('modbus.enable_polling')}</span><ToggleSwitch label={t('modbus.enable_polling')} checked={connectionForm.enabled} onCheckedChange={enabled => setConnectionForm({ ...connectionForm, enabled })} /></div>
        </> : <>
          <Input label={t('modbus.name')} value={variableForm.name} maxLength={80} required onChange={e => setVariableForm({ ...variableForm, name: e.target.value })} />
          <ModbusProfileSelect value={variableForm.profileId} onChange={profileId => setVariableForm({ ...variableForm, profileId: profileId || undefined, symbolicAddress: profileId ? 'D0' : undefined, area: profileId ? 'holding_register' : variableForm.area, address: profileId ? 0 : variableForm.address, dataType: profileId ? 'uint16' : variableForm.dataType, writable: false })} />
          {variableForm.profileId ? <ModbusAddressFields profileId={variableForm.profileId} symbol={variableForm.symbolicAddress ?? ''} capacities={connections.find(item => item.id === (editor?.kind === 'variable' ? editor.connectionId : ''))?.moduleCapacities} onSymbol={symbolicAddress => {
            try { const resolved = resolveModbusAddress(variableForm.profileId!, symbolicAddress); const bit = resolved.area === 'coil' || resolved.area === 'discrete_input'; setVariableForm({ ...variableForm, symbolicAddress, area: resolved.area, address: resolved.address, dataType: bit ? 'boolean' : variableForm.dataType === 'boolean' ? 'uint16' : variableForm.dataType, scale: bit ? 1 : variableForm.scale, offset: bit ? 0 : variableForm.offset, writable: false }); }
            catch { setVariableForm({ ...variableForm, symbolicAddress, writable: false }); }
          }} /> : <>
            <NumberInput label={t('modbus.address')} helperText={t('modbus.address_hint')} min={0} max={65536 - modbusWordCount(variableForm.dataType)} value={variableForm.address} onValueChange={address => setVariableForm({ ...variableForm, address })} onEmpty={() => setVariableForm({ ...variableForm, address: NaN })} />
            <SearchableSelectField label={t('modbus.area')} value={variableForm.area} options={(['coil', 'discrete_input', 'holding_register', 'input_register'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => { const area = value as ModbusVariable['area']; setVariableForm({ ...variableForm, area, dataType: area === 'coil' || area === 'discrete_input' ? 'boolean' : 'uint16', writable: false, scale: 1, offset: 0 }); }} />
          </>}
          <SearchableSelectField label={t('modbus.dataType')} value={variableForm.dataType} options={(variableForm.area === 'coil' || variableForm.area === 'discrete_input' ? ['boolean'] : modbusRegisterTypes).map(value => ({ value, label: value }))} onChange={value => setVariableForm({ ...variableForm, dataType: value as ModbusVariable['dataType'] })} />
          {variableForm.dataType !== 'boolean' && <>
            <NumberInput label={t('modbus.scale')} step="any" value={variableForm.scale} onValueChange={scale => setVariableForm({ ...variableForm, scale })} onEmpty={() => setVariableForm({ ...variableForm, scale: NaN })} />
            <NumberInput label={t('modbus.offset')} step="any" value={variableForm.offset} onValueChange={offset => setVariableForm({ ...variableForm, offset })} onEmpty={() => setVariableForm({ ...variableForm, offset: NaN })} />
            <MeasurementUnitSelect label={t('modbus.unit')} value={variableForm.unit} onChange={unit => setVariableForm({ ...variableForm, unit })} />
          </>}
          {modbusWordCount(variableForm.dataType) === 2 && <SearchableSelectField label={t('modbus.wordOrder')} value={variableForm.wordOrder} options={(['high_first', 'low_first'] as const).map(value => ({ value, label: t(`modbus.${value}`) }))} onChange={value => setVariableForm({ ...variableForm, wordOrder: value as ModbusVariable['wordOrder'] })} />}
          {modbusWordCount(variableForm.dataType) === 2 && <p className="text-caption text-muted-foreground sm:col-span-2">{t('modbus.two_words')}</p>}
          {canWrite && <div className="flex items-center justify-between gap-3 sm:col-span-2"><span className="text-body-compact">{t('modbus.allow_write')}</span><ToggleSwitch label={t('modbus.allow_write')} checked={variableForm.writable} onCheckedChange={writable => setVariableForm({ ...variableForm, writable })} /></div>}
          <p className="text-caption text-muted-foreground sm:col-span-2">{t('modbus.assignment_hint')}</p>
        </>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3 sm:col-span-2">
          {(editor?.kind === 'connection' ? editor.id : editor?.deviceId) && <Button variant="ghost" className="mr-auto text-danger" type="button" size="lg" disabled={busy} onClick={() => { setFormError(''); setConfirmDelete(true); }}><Trash2 aria-hidden="true" className="size-4" />{t('modbus.delete')}</Button>}
          <Button variant="secondary" type="button" size="lg" disabled={busy} onClick={close}>{t('modbus.cancel')}</Button><Button type="submit" size="lg" isLoading={busy}>{t('modbus.save')}</Button></div>
      </form>
    </Modal>
    <Modal isOpen={confirmDelete} onClose={() => { if (!busy) setConfirmDelete(false); }} title={t(editor?.kind === 'connection' ? 'modbus.delete_connection' : 'modbus.delete_variable')} description={t('modbus.delete_confirmation')} headerAlign="start">
      <p className="mb-4 break-words font-semibold">{editor?.kind === 'connection' ? connectionForm.name : variableForm.name}</p>
      {formError && <AlertBanner role="alert" variant="danger" message={formError} />}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" size="lg" disabled={busy} onClick={() => { setFormError(''); setConfirmDelete(false); }}>{t('modbus.cancel')}</Button><Button variant="danger" size="lg" isLoading={busy} onClick={() => void remove()}>{t('modbus.delete')}</Button></div>
    </Modal>
  </div>;
}
