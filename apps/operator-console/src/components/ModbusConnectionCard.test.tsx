import { renderToStaticMarkup } from 'react-dom/server';
import { ModbusConnectionCard, type ModbusConnectionSummary } from './ModbusConnectionCard';
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }) }));
jest.mock('../stores/useDeviceSnapshotStore', () => ({ useDeviceSnapshotStore: (selector: (state: { devices: never[] }) => unknown) => selector({ devices: [] }) }));

describe('Feature: Compact Modbus navigation (AC40)', () => {
  const connection: ModbusConnectionSummary = { id: 'c', homeId: 'h', name: 'PLC', host: '127.0.0.1', port: 502, unitId: 1, enabled: true, timeoutMs: 2000, pollIntervalMs: 5000, variables: [10, 2, 1].map(number => ({ deviceId: `v${number}`, connectionId: 'c', name: `Point ${number}`, symbolicAddress: `M${number}`, area: 'coil', address: number, dataType: 'boolean', scale: 1, offset: 0, wordOrder: 'high_first', unit: '', writable: false, plc: { role: 'output_command', command: { profileId: 'xinje-xl5e-16t-v1', symbolicAddress: `M${number}`, area: 'coil', address: number }, mode: 'sustained', feedbackPolicy: 'none', feedbackTimeoutMs: 2000, pulseDurationMs: 500 } })) };
  const callbacks = { onEdit: jest.fn(), onAdd: jest.fn(), onVariable: jest.fn(), onCommand: jest.fn() };
  it('Scenario: Natural order and shared warning preserve configurations without executing callbacks (AC40)', () => {
    const before = JSON.stringify(connection);
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={connection} {...callbacks} />);
    expect(html.indexOf('Point 1<')).toBeLessThan(html.indexOf('Point 2<'));
    expect(html.indexOf('Point 2<')).toBeLessThan(html.indexOf('Point 10<'));
    expect(html.match(/plc.no_independent_feedback/g)).toHaveLength(1);
    expect(html).toContain('modbus.search_variables');
    expect(html).toContain('role="radiogroup"');
    expect(html).not.toContain('data-modbus-variable-group="feedback"');
    expect(html).toContain('127.0.0.1:502');
    expect(JSON.stringify(connection)).toBe(before);
    Object.values(callbacks).forEach(callback => expect(callback).not.toHaveBeenCalled());
  });
  it('Scenario: Summary hides detail navigation and presents explicit opening control (AC40)', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={connection} {...callbacks} onOpen={() => {}} />);
    expect(html).toContain('plc.open_connection');
    expect(html).not.toContain('modbus.search_variables');
    expect(html).not.toContain('Point 10');
  });
});
