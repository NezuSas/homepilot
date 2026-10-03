import { renderToStaticMarkup } from 'react-dom/server';
import { PlcBindingEditor } from './PlcBindingEditor';
import { ModbusConnectionCard, ModbusConnectionCardSkeleton } from './ModbusConnectionCard';
import type { ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: (selector: (state: { devices: [] }) => unknown) => selector({ devices: [] }) }));
const base: Omit<ModbusVariable, 'deviceId' | 'connectionId'> = { name: 'PLC', profileId: 'xinje-xl5e-16t-v2', symbolicAddress: 'D100', area: 'holding_register', address: 100, dataType: 'uint16', scale: 1, offset: 0, wordOrder: 'high_first', unit: '', writable: false };
describe('Feature: PLC binding editor (AC26)', () => {
  it('Scenario: Historical variable shows no inferred PLC relationships', () => {
    const html = renderToStaticMarkup(<PlcBindingEditor variable={base} onChange={() => {}} />);
    expect(html).toContain('plc.legacy'); expect(html).not.toContain('plc.feedback_timeout');
  });
  it('Scenario: Setpoint uses the modular numeric fields for explicit bounds', () => {
    const html = renderToStaticMarkup(<PlcBindingEditor variable={{ ...base, plc: { role: 'setpoint', min: 5, max: 40, mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } }} onChange={() => {}} />);
    expect(html).toContain('plc.minimum'); expect(html).toContain('plc.maximum'); expect(html).toContain('plc.setpoint_hint');
  });
  it('Scenario: A disconnected PLC never presents its previous true reading as active', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, diagnostic: { status: 'unavailable' }, variables: [{ ...base, deviceId: 'v', connectionId: 'c', dataType: 'boolean', diagnostic: { status: 'online', value: true, confirmation: 'unconfirmed' } }] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} />);
    expect(html).toContain('plc.unavailable'); expect(html).toContain('plc.confirmations.unconfirmed'); expect(html).not.toContain('plc.on');
  });
  it('Scenario: Connection skeleton has no physical command controls', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCardSkeleton />);
    expect(html).not.toContain('<button'); expect(html).toContain('aria-hidden="true"');
  });
  it.each(['pending', 'unconfirmed'])('Scenario: %s separates the requested ON from actual OFF', confirmation => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, diagnostic: { status: 'online' }, variables: [{ ...base, deviceId: 'v', connectionId: 'c', dataType: 'boolean', diagnostic: { status: 'online', value: false, commandedState: true, confirmation } }] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} />);
    expect(html).toContain('plc.requested_state: plc.on');
    expect(html).toContain('plc.actual_state: plc.off');
    expect(html).toContain(`plc.confirmations.${confirmation}`);
  });
  it.each([['online', 'plc.connected'], ['unavailable', 'plc.disconnected'], ['error', 'plc.error']] as const)('Scenario: Connection %s has an independent connectivity label', (status, label) => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, diagnostic: { status, error: 'private transport message' }, variables: [] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} />);
    expect(html).toContain(label); expect(html).toContain('plc.enabled'); expect(html).toContain('plc.errors.unknown'); expect(html).not.toContain('private transport message');
  });
  it('Scenario: Read-only measurement reuses the level visualizer and has no command action', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, diagnostic: { status: 'online' }, variables: [{ ...base, deviceId: 'v', connectionId: 'c', visualStyle: 'level', unit: '%', diagnostic: { status: 'online', value: 0 }, plc: { role: 'measurement', mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } }] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} onCommand={() => {}} />);
    expect(html).toContain('data-sensor-visualizer="level"'); expect(html).toContain('aria-valuenow="0"'); expect(html).not.toContain('plc.test_command');
  });
  it('Scenario: Pulse exposes activation and explicitly absent feedback', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, variables: [{ ...base, deviceId: 'v', connectionId: 'c', writable: true, plc: { role: 'output', mode: 'pulse', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } }] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} onCommand={() => {}} />);
    expect(html).toContain('plc.activate'); expect(html).toContain('plc.not_configured'); expect(html).toContain('500 ms');
  });
  it('Scenario: A connection error never renders the retained measurement as a live meter', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={{ id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: true, diagnostic: { status: 'error' }, variables: [{ ...base, deviceId: 'v', connectionId: 'c', visualStyle: 'level', unit: '%', diagnostic: { status: 'online', value: 25 }, plc: { role: 'measurement', mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } }] }} onEdit={() => {}} onAdd={() => {}} onVariable={() => {}} />);
    expect(html).toContain('plc.unavailable'); expect(html).not.toContain('aria-valuenow="25"');
  });
});
