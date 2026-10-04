import { ArrowDownToLine, ArrowUpFromLine, Cable, Settings, Variable } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ModbusConnection, ModbusVariable, ModbusDiagnostic } from '../../../../packages/integrations/modbus/domain/Modbus';
import { Button } from './ui/Button';
import { LoadingState } from './ui/LoadingState';
import { DashboardSkeletonBar as Bar } from './ui/DashboardCardSkeleton';
import { useDeviceSnapshotStore } from '../stores/useDeviceSnapshotStore';
import { modbusAddressProfiles } from '../../../../packages/integrations/modbus/domain/ModbusAddressProfile';
import { plcConnectionAvailable, plcConnectionKey, plcErrorKey, plcReadFunction, plcSensorDevice } from '../lib/plcUi';
import { SensorMetricCard } from '../views/dashboards/widgets/SensorMetricCard';
import { formatMeasurement } from '../lib/formatMeasurement';

export type ModbusConnectionSummary = ModbusConnection & { diagnostic?: ModbusDiagnostic; variables: (ModbusVariable & { diagnostic?: ModbusDiagnostic })[] };
export function getModbusVariableGroup(variable: ModbusVariable): 'input' | 'output' | 'variable' {
  if (variable.plc?.role === 'input') return 'input';
  if (variable.plc && ['output', 'output_command', 'output_feedback'].includes(variable.plc.role)) return 'output';
  return 'variable';
}
const variableGroups = [
  { id: 'input', label: 'plc.roles.input', icon: ArrowDownToLine },
  { id: 'output', label: 'plc.roles.output', icon: ArrowUpFromLine },
  { id: 'variable', label: 'modbus.variables', icon: Variable },
] as const;
export function ModbusConnectionCard({ connection, onEdit, onAdd, onVariable, onCommand, onOpen }: {
  connection: ModbusConnectionSummary; onEdit: () => void; onAdd: () => void; onVariable: (variable: ModbusVariable) => void; onCommand?: (variable: ModbusVariable) => void;
  onOpen?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const devices = useDeviceSnapshotStore(state => state.devices);
  const profile = modbusAddressProfiles.find(profile => profile.id === connection.profileId);
  const errors = connection.variables.filter(variable => variable.diagnostic?.error || ['variable_error', 'error', 'unavailable'].includes(variable.diagnostic?.status ?? '')).length;
  const ok = connection.variables.filter(variable => variable.diagnostic?.status === 'online' && !variable.diagnostic.error).length;
  const date = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(i18n?.language ?? 'es', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value)) : '—';
  return <section aria-label={connection.name} className="min-w-0 rounded-section border border-border bg-card p-4 text-card-foreground">
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="flex min-w-0 items-center gap-3"><Cable aria-hidden="true" className="size-5 shrink-0 text-primary" />
        <div className="min-w-0"><h2 className="break-words font-semibold">{connection.name}</h2><p className="break-words text-caption text-muted-foreground">{connection.host} · Modbus TCP · {connection.port} · {t('modbus.unitId')} {connection.unitId}</p>{profile && <p className="text-caption text-muted-foreground">{profile.manufacturer} {profile.model} · v{profile.version}</p>}</div>
      </div>
      <div className="flex items-center justify-between gap-3"><div className="text-caption text-muted-foreground"><p>{t(connection.enabled ? 'plc.enabled' : 'modbus.disabled')}</p>{connection.enabled && <p role="status">{t(plcConnectionKey(connection))}</p>}</div>
        <Button variant="secondary" size="lg" onClick={onEdit}><Settings aria-hidden="true" className="size-4" />{t('modbus.configure')}</Button>
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="text-caption text-muted-foreground">{t('plc.variable_count', { count: connection.variables.length })} · {t('plc.variables_ok')}: {ok} · {t('plc.variables_error')}: {errors}</p>{onOpen && <Button variant="outline" onClick={onOpen}>{t('plc.open_connection')}</Button>}</div>
    {!onOpen && <>
    <details className="mt-3 border-t border-border pt-2 text-caption text-muted-foreground"><summary className="cursor-pointer py-2">{t('plc.connection_diagnostics')}</summary><dl className="grid gap-x-4 gap-y-2 py-2 sm:grid-cols-2"><div><dt>{t('plc.last_communication')}</dt><dd>{date(connection.diagnostic?.lastReadAt)}</dd></div><div><dt>{t('plc.latency')}</dt><dd>{connection.diagnostic?.latencyMs ?? '—'} ms</dd></div>{connection.diagnostic?.retryAt && <div><dt>{t('plc.retry_at')}</dt><dd>{date(connection.diagnostic.retryAt)}</dd></div>}{connection.diagnostic?.error && <div><dt>{t('plc.last_error')}</dt><dd role="status">{t(plcErrorKey(connection.diagnostic.error))}</dd></div>}</dl></details>
    {connection.variables.length ? <div aria-label={t('plc.title')} className="mt-4 space-y-6 border-t border-border pt-4">{variableGroups.map(group => {
      const variables = connection.variables.filter(variable => getModbusVariableGroup(variable) === group.id);
      return <section key={group.id} aria-label={t(group.label)} data-modbus-variable-group={group.id}>
      <div className="mb-2 flex items-center gap-2 border-b border-border pb-2"><group.icon className="size-5 shrink-0 text-primary" aria-hidden="true" /><h3 className="text-body-compact font-semibold">{t(group.label)}</h3><span className="ml-auto text-caption tabular-nums text-muted-foreground">{variables.length}</span></div>
      {!variables.length && <p className="py-2 text-caption text-muted-foreground">{t('modbus.no_variables')}</p>}
      <ul className="divide-y divide-border">{variables.map(variable => {
        const state = devices.find(device => device.id === variable.deviceId)?.lastKnownState;
        const value = variable.diagnostic?.value ?? state?.value;
        const confirmation = variable.diagnostic?.confirmation ?? state?.confirmation;
        const commanded = variable.diagnostic?.commandedState ?? state?.commandedState;
        const hasCommand = typeof commanded === 'boolean' || typeof commanded === 'number';
        const unavailable = !plcConnectionAvailable(connection) || (variable.diagnostic?.status !== undefined ? variable.diagnostic.status !== 'online' : state?.available === false || state?.stale === true);
        return <li key={variable.deviceId} className="flex flex-wrap items-start gap-2 py-2">
          <div className="min-w-0 basis-full sm:basis-0 sm:flex-1"><p className="break-words text-body-compact font-medium">{variable.name}</p>
            <p className="break-words text-caption text-muted-foreground">{t(variable.plc ? `plc.roles.${variable.plc.role}` : 'plc.legacy')} · {variable.symbolicAddress ?? `${t(`modbus.${variable.area}`)} ${variable.address}`} · {t(variable.writable ? 'modbus.write_allowed' : 'modbus.read_only')}</p>
            {variable.plc && <p className="break-words text-caption text-muted-foreground">{[variable.plc.command && `${t('plc.command')}: ${variable.plc.command.symbolicAddress}`, variable.plc.physical && `${t('plc.physical')}: ${variable.plc.physical.symbolicAddress}`, variable.plc.logical && `${t('plc.logical')}: ${variable.plc.logical.symbolicAddress}`, ['output', 'output_command'].includes(variable.plc.role) && `${t('plc.feedback')}: ${variable.plc.feedback?.symbolicAddress ?? t('plc.not_configured')}`].filter(Boolean).join(' · ')}</p>}
            {variable.plc?.mode === 'pulse' && <p className="text-caption text-muted-foreground">{t('plc.modes.pulse')} · {variable.plc.pulseDurationMs} ms</p>}
            {variable.plc?.role === 'setpoint' && <p className="text-caption text-muted-foreground">{t('plc.limits')}: {variable.plc.min} – {variable.plc.max} {variable.unit}</p>}
            {hasCommand && <p className="text-caption tabular-nums">{t('plc.requested_state')}: {typeof commanded === 'boolean' ? t(commanded ? 'plc.on' : 'plc.off') : `${formatMeasurement(commanded as number)} ${variable.unit}`}</p>}
            <p className="text-body-compact tabular-nums">{hasCommand && <>{t('plc.actual_state')}: </>}{unavailable ? t('plc.unavailable') : value === undefined ? t('plc.awaiting') : typeof value === 'boolean' ? t(value ? 'plc.on' : 'plc.off') : `${typeof value === 'number' ? formatMeasurement(value) : value} ${variable.unit}`}{typeof confirmation === 'string' && <> · {t(`plc.confirmations.${confirmation}`)}</>}</p>
            {variable.plc?.role === 'measurement' && <div className="mt-2 w-full max-w-xs"><SensorMetricCard title={variable.name} sensorDecimals visualStyle={variable.visualStyle} device={plcSensorDevice(variable, plcConnectionAvailable(connection), devices.find(device => device.id === variable.deviceId))} /></div>}
            {variable.diagnostic?.error && <p role="status" className="text-caption text-danger">{t(plcErrorKey(variable.diagnostic.error))}</p>}
            <details className="text-caption text-muted-foreground"><summary className="cursor-pointer py-1">{t('plc.technical')}</summary><p className="break-words">{t(`modbus.${variable.area}`)} · PDU {variable.address} · {plcReadFunction(variable.area)} · {variable.dataType} · {variable.wordOrder}</p><p>{t('modbus.scale')}: {variable.scale} · {t('modbus.offset')}: {variable.offset}</p><p className="break-words">RAW {variable.diagnostic?.raw?.join(', ') ?? '—'} · {variable.diagnostic?.latencyMs ?? '—'} ms · {date(variable.diagnostic?.lastReadAt)}</p></details>
          </div>
          <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button variant="ghost" size="lg" aria-label={t('modbus.edit_variable', { name: variable.name })} onClick={() => onVariable(variable)}>{t('modbus.configure')}</Button>
            {variable.writable && variable.plc && onCommand && <Button variant="outline" size="lg" disabled={!connection.enabled} aria-label={t('plc.test_command_named', { name: variable.name })} onClick={() => onCommand(variable)}>{t(variable.plc.mode === 'pulse' ? 'plc.activate' : variable.plc.role === 'setpoint' ? 'plc.edit_setpoint' : 'plc.test_command')}</Button>}
          </div>
        </li>;
      })}</ul>
    </section>;
    })}</div> : <p className="my-3 text-caption text-muted-foreground">{t('modbus.no_variables')}</p>}
    <Button variant="outline" size="lg" onClick={onAdd}>{t('modbus.add_variable')}</Button>
    </>}
  </section>;
}
export function ModbusConnectionCardSkeleton({ summary = false }: { summary?: boolean }) {
  if (summary) return <div aria-hidden="true" className="min-w-0 rounded-section border border-border bg-card p-4"><div className="flex items-center gap-3"><Bar className="size-5" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-40 max-w-full" /><Bar className="h-4 w-48 max-w-full" /></div><Bar className="h-11 w-24" /></div><div className="mt-3 flex justify-between gap-3 border-t border-border pt-3"><Bar className="h-5 w-44 max-w-full" /><Bar className="h-11 w-28" /></div></div>;
  return <div aria-hidden="true" className="min-w-0 rounded-section border border-border bg-card p-4"><div className="flex flex-wrap gap-3"><Bar className="size-5" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-40 max-w-full" /><Bar className="h-4 w-48 max-w-full" /></div><Bar className="h-11 w-28" /></div><div className="mt-3 border-t border-border pt-3">{variableGroups.map(group => <div key={group.id} data-modbus-group-skeleton={group.id} className="mb-4"><div className="mb-2 flex items-center gap-2 border-b border-border pb-2"><Bar className="size-5" /><Bar className="h-5 w-24" /><Bar className="ml-auto h-4 w-5" /></div>{[0, 1].map(index => <div key={index} className="flex flex-wrap gap-2 border-b border-border py-2"><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-40 max-w-full" /><Bar className="h-4 w-48 max-w-full" /><Bar className="h-4 w-56 max-w-full" /><Bar className="h-5 w-28" /><Bar className="h-4 w-32" /></div><Bar className="h-11 w-28" /></div>)}</div>)}<Bar className="mt-3 h-11 w-36" /></div></div>;
}
export function ModbusSettingsSkeleton({ label, className }: { label: string; className?: string }) {
  return <LoadingState label={label} className={className}><Bar className="h-8 w-48" /><div className="grid gap-4 lg:grid-cols-2"><ModbusConnectionCardSkeleton summary /><ModbusConnectionCardSkeleton summary /></div></LoadingState>;
}
