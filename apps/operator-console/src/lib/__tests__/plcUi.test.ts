import { plcConnectionAvailable, plcConnectionKey, plcErrorKey, plcSensorDevice, plcReadFunction, plcResponseError, plcStatusLabel } from '../plcUi';
import type { ModbusVariable, ModbusDiagnostic } from '../../../../../packages/integrations/modbus/domain/Modbus';
import es from '../../locales/es/common.json';
import en from '../../locales/en/common.json';
const variable: ModbusVariable = { deviceId: 'v', connectionId: 'c', name: 'Temperature', area: 'holding_register', address: 100, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, unit: '°C', writable: false, visualStyle: 'thermometer' };
describe('Feature: PLC installer presentation (AC28/AC30/AC32)', () => {
  it.each([es, en])('Scenario: Individual output read state and command RAW are explicit without confirmation (AC38)', translations => {
    for (const key of ['physical_read_state', 'command_raw', 'command_read_state'] as const) {
      expect(translations.plc[key]).toBeTruthy();
      expect(translations.plc[key]).not.toMatch(/confirmado|confirmación|\bconfirmed\b|\bconfirmation\b/i);
    }
  });
  it.each([es, en])('Scenario: Related outputs have complete translations (AC37)', translations => {
    for (const key of ['related_outputs', 'command_read_state', 'add_related_output', 'remove_related_output', 'related_outputs_hint'] as const) expect(translations.plc[key]).toBeTruthy();
    expect(translations.plc.related_outputs_hint).toMatch(/No configura|Does not configure/);
  });
  it.each([
    ['confirmed', 'plc.command_read_matches'],
    ['pending', 'plc.command_read_pending'],
    ['unconfirmed', 'plc.command_read_unverified'],
    ['reset_failed', 'plc.confirmations.reset_failed'],
    ['pulse_completed', 'plc.confirmations.pulse_completed'],
  ])('Scenario: No-feedback %s is readback wording only (AC26)', (confirmation, label) => {
    const v: ModbusVariable = { ...variable, plc: { role: 'output', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, mode: 'sustained', pulseDurationMs: 500 } };
    const original = JSON.stringify(v);
    expect(plcStatusLabel(v, confirmation, true)).toBe(label);
    expect(JSON.stringify(v)).toBe(original);
    expect(plcStatusLabel(v, 'unknown', true)).toBeUndefined();
    expect(plcStatusLabel(v, undefined, true)).toBeUndefined();
    expect(plcStatusLabel(v, 'confirmed', false)).toBe('plc.command_read_unavailable');
  });
  it.each(['optional', 'required'] as const)('Scenario: %s retains independent feedback status wording (AC26)', feedbackPolicy => {
    const v: ModbusVariable = { ...variable, plc: { role: 'output', feedbackPolicy, feedbackTimeoutMs: 2000, mode: 'sustained', pulseDurationMs: 500 } };
    expect(plcStatusLabel(v, 'confirmed', true)).toBe('plc.confirmations.confirmed');
  });
  it.each(['es', 'en'])('Scenario: %s no-feedback translations never say confirmed or confirmation (AC26)', language => {
    const translations = language === 'es' ? es : en;
    for (const key of ['feedback_policy', 'read_state', 'command_read_matches', 'command_read_pending', 'command_read_unverified', 'command_read_unavailable'] as const) {
      expect(translations.plc[key]).toBeTruthy();
      expect(translations.plc[key]).not.toMatch(/confirmado|confirmación|\bconfirmed\b|\bconfirmation\b/i);
    }
  });
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
