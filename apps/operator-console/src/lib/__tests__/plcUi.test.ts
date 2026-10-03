import { plcConnectionAvailable, plcConnectionKey, plcErrorKey, plcSensorDevice, plcReadFunction, plcResponseError } from '../plcUi';
import type { ModbusVariable, ModbusDiagnostic } from '../../../../../packages/integrations/modbus/domain/Modbus';
const variable: ModbusVariable = { deviceId: 'v', connectionId: 'c', name: 'Temperature', area: 'holding_register', address: 100, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, unit: '°C', writable: false, visualStyle: 'thermometer' };
describe('Feature: PLC installer presentation (AC28/AC30/AC32)', () => {
  it('Scenario: Enabled is not connected and disabled overrides old diagnostics', () => {
    expect(plcConnectionKey({ enabled: true })).toBe('plc.awaiting_connection');
    expect(plcConnectionKey({ enabled: false, diagnostic: { status: 'online' } })).toBe('modbus.disabled');
    expect(plcConnectionKey({ enabled: true, diagnostic: { status: 'online' } })).toBe('plc.connected');
    expect(plcConnectionKey({ enabled: true, diagnostic: { status: 'unavailable' } })).toBe('plc.disconnected');
    expect(plcConnectionKey({ enabled: true, diagnostic: { status: 'unavailable', retryAt: '2026-10-03T12:00:00Z' } })).toBe('plc.reconnecting');
    expect(plcConnectionKey({ enabled: true, diagnostic: { status: 'error' } })).toBe('plc.error');
  });
  it.each(['TIMEOUT', 'CONNECTION', 'INVALID_CONFIG', 'CONVERSION', 'READ_ONLY', 'FORBIDDEN', 'FEEDBACK_TIMEOUT', 'RESET_FAILED'])('Scenario: %s has safe translated wording', code => {
    expect(plcErrorKey(code)).not.toBe('plc.errors.unknown');
    expect(plcErrorKey('Private stack 192.168.1.5')).toBe('plc.errors.unknown');
  });
  it.each(['unavailable', 'variable_error', 'error'] as ModbusDiagnostic['status'][])('Scenario: %s keeps an old value unavailable', status => {
    const device = plcSensorDevice({ ...variable, diagnostic: { status, value: 25 } }, true);
    expect(device.lastKnownState).toMatchObject({ state: 'unavailable', available: false, value: 25 });
  });
  it('Scenario: Actual zero stays real and uses the existing sensor shape', () => {
    const device = plcSensorDevice({ ...variable, diagnostic: { status: 'online', value: 0 } }, true);
    expect(device).toMatchObject({ type: 'sensor', integrationSource: 'modbus-tcp', lastKnownState: { state: '0', value: 0, available: true, plcVisualStyle: 'thermometer' } });
    expect(plcSensorDevice({ ...variable, diagnostic: { status: 'online', value: 0 } }, false).lastKnownState?.available).toBe(false);
  });
  it.each(['error', 'unavailable'] as const)('Scenario: Connection %s overrides a retained online measurement in list and preview', status => {
    const device = plcSensorDevice({ ...variable, diagnostic: { status: 'online', value: 25 } }, plcConnectionAvailable({ enabled: true, diagnostic: { status } }));
    expect(device.lastKnownState).toMatchObject({ value: 25, available: false, stale: true, state: 'unavailable' });
  });
  it('Scenario: All read areas keep their existing Function Codes', () => {
    expect(['coil', 'discrete_input', 'holding_register', 'input_register'].map(area => plcReadFunction(area as ModbusVariable['area']))).toEqual(['FC01', 'FC02', 'FC03', 'FC04']);
  });
  it('Scenario: API error codes are parsed but private messages never surface', async () => {
    expect(await plcResponseError(new Response(JSON.stringify({ error: { code: 'TIMEOUT', message: 'private transport stack' } }), { status: 400 }))).toBe('plc.errors.timeout');
    expect(await plcResponseError(new Response('bad gateway', { status: 502 }))).toBe('plc.errors.unknown');
    expect(await plcResponseError(new Response('', { status: 403 }))).toBe('plc.errors.permission');
  });
});
