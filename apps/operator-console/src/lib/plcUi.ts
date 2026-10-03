import type { ModbusConnection, ModbusDiagnostic, ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import type { SnapshotDevice } from '../stores/useDeviceSnapshotStore';

/** UI wording only; the service/dispatcher remain authoritative. Unknown errors never expose transport text. */
export function plcErrorKey(code: unknown): string {
  const keys: Record<string, string> = { TIMEOUT: 'timeout', CONNECTION: 'connection', connection_error: 'connection', INVALID_CONFIG: 'mapping', CONVERSION: 'conversion', READ_ONLY: 'write_rejected', FORBIDDEN: 'permission', FEEDBACK_TIMEOUT: 'feedback', RESET_FAILED: 'reset', DISABLED: 'disabled', PROTOCOL: 'protocol', NOT_FOUND: 'missing', LIMIT: 'busy', IN_USE: 'in_use' };
  return `plc.errors.${typeof code === 'string' ? keys[code] ?? 'unknown' : 'unknown'}`;
}
export function plcConnectionKey(connection: Pick<ModbusConnection, 'enabled'> & { diagnostic?: ModbusDiagnostic }): string {
  if (!connection.enabled) return 'modbus.disabled';
  const diagnostic = connection.diagnostic;
  if (diagnostic?.status === 'online') return 'plc.connected';
  if (diagnostic?.status === 'unavailable') return diagnostic.retryAt ? 'plc.reconnecting' : 'plc.disconnected';
  if (diagnostic?.status === 'error' || diagnostic?.status === 'variable_error') return 'plc.error';
  return 'plc.awaiting_connection';
}
export function plcConnectionAvailable(connection?: Pick<ModbusConnection, 'enabled'> & { diagnostic?: ModbusDiagnostic }): boolean {
  return !!connection?.enabled && !['unavailable', 'error'].includes(connection.diagnostic?.status ?? '');
}
export function plcSensorDevice(variable: ModbusVariable & { diagnostic?: ModbusDiagnostic }, enabled: boolean, snapshot?: SnapshotDevice): SnapshotDevice {
  const diagnostic = variable.diagnostic;
  const value = diagnostic?.value ?? snapshot?.lastKnownState?.value;
  const available = enabled && (diagnostic?.status !== undefined ? diagnostic.status === 'online' && value !== undefined : snapshot?.lastKnownState?.available === true && snapshot.lastKnownState.stale !== true && !diagnostic?.error);
  return { id: variable.deviceId, homeId: snapshot?.homeId ?? '', roomId: snapshot?.roomId ?? null, name: variable.name, type: 'sensor', status: snapshot?.status ?? 'PENDING', integrationSource: 'modbus-tcp', lastKnownState: { ...snapshot?.lastKnownState, state: available ? String(value) : 'unavailable', value, available, stale: !available, unit_of_measurement: variable.unit, plcVisualStyle: variable.visualStyle } };
}
export function plcReadFunction(area: ModbusVariable['area']): string {
  return { coil: 'FC01', discrete_input: 'FC02', holding_register: 'FC03', input_register: 'FC04' }[area];
}
export async function plcResponseError(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) return plcErrorKey('FORBIDDEN');
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const error = body.error;
      if (typeof error === 'string') return plcErrorKey(error);
      if (error && typeof error === 'object' && 'code' in error) return plcErrorKey(error.code);
    }
  } catch { /* Safe fallback for non-JSON errors. */ }
  return plcErrorKey(undefined);
}
