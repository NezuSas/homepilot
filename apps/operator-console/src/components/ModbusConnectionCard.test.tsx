import { renderToStaticMarkup } from 'react-dom/server';
import { ModbusConnectionCard, ModbusConnectionCardSkeleton, type ModbusConnectionSummary } from './ModbusConnectionCard';
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
  it('Scenario: Compact tiles fit as many columns as the width allows and keep technical detail behind one switch (AC40)', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCard connection={connection} {...callbacks} />);
    expect(html).toContain('data-modbus-variable-grid');
    expect(html).toContain('grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]');
    expect(html).toContain('plc.technical_details');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('data-modbus-variable-diagnostic');
    expect(html).not.toContain('PDU 1');
    expect(html).toContain('data-modbus-variable-id="v1"');
  });
  it('Scenario: Initial detail skeleton fills two compact rows without actions (AC40)', () => {
    const html = renderToStaticMarkup(<ModbusConnectionCardSkeleton />);
    expect(html).toContain('grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))]');
    expect(html.match(/rounded-panel border border-border px-3 py-2/g)).toHaveLength(4);
    expect(html).not.toContain('<button');
  });
});

describe('Feature: a PLC that does not answer is explained, not alarmed about', () => {
  const base: ModbusConnectionSummary = { id: 'c', homeId: 'h', name: 'PLC', host: '192.168.1.5', port: 502, unitId: 1, enabled: true, timeoutMs: 2000, pollIntervalMs: 5000, variables: [{ deviceId: 'v1', connectionId: 'c', name: 'Point 1', area: 'holding_register', address: 1, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, writable: false, diagnostic: { status: 'unavailable' } } as never] };
  const callbacks = { onEdit: jest.fn(), onAdd: jest.fn(), onVariable: jest.fn(), onCommand: jest.fn() };
  const render = (connection: ModbusConnectionSummary) => renderToStaticMarkup(<ModbusConnectionCard connection={connection} {...callbacks} onOpen={() => {}} />);

  it('Scenario: Given a PLC that never answered When the connection is shown Then it says what to check and that nothing was read', () => {
    const html = render({ ...base, diagnostic: { status: 'unavailable' } });

    expect(html).toContain('plc.unreachable_hint');
    expect(html).toContain('plc.never_read');
    expect(html).toContain('plc.variables_waiting');
    expect(html).not.toContain('plc.variables_error');
  });
  it('Scenario: Given a PLC that answered before When it stops Then the last good reading time is given', () => {
    const html = render({ ...base, diagnostic: { status: 'unavailable', lastReadAt: '2026-10-12T10:00:00.000Z' } });

    expect(html).toContain('plc.last_good_read');
    expect(html).not.toContain('plc.never_read');
  });
  it('Scenario: Given a known failure When the PLC does not answer Then the translated cause replaces the generic hint', () => {
    const html = render({ ...base, diagnostic: { status: 'unavailable', error: 'TIMEOUT' } });

    expect(html).toContain('plc.errors.timeout');
    expect(html).not.toContain('plc.unreachable_hint');
  });
  it('Scenario: Given a healthy PLC When shown Then it keeps the variable counts and shows no warning', () => {
    const html = render({ ...base, diagnostic: { status: 'online' }, variables: [{ ...base.variables[0]!, diagnostic: { status: 'online', value: 1 } }] });

    expect(html).toContain('plc.variables_ok');
    expect(html).toContain('plc.variables_error');
    expect(html).not.toContain('plc.unreachable_hint');
    expect(html).not.toContain('plc.variables_waiting');
  });
  it('Scenario: Given a disabled connection When shown Then nothing claims it is failing', () => {
    const html = render({ ...base, enabled: false });

    expect(html).toContain('modbus.disabled');
    expect(html).not.toContain('plc.unreachable_hint');
    expect(html).not.toContain('plc.variables_waiting');
  });
  it.each([
    [{ enabled: false }, 'neutral'],
    [{ enabled: true, diagnostic: { status: 'online' as const } }, 'success'],
    [{ enabled: true, diagnostic: { status: 'unavailable' as const, retryAt: '2026-10-12T10:00:00.000Z' } }, 'warning'],
    [{ enabled: true, diagnostic: { status: 'unavailable' as const } }, 'danger'],
    [{ enabled: true, diagnostic: { status: 'error' as const } }, 'danger'],
    [{ enabled: true }, 'neutral'],
  ])('Scenario: connection %j has the %s tone', async (connection, tone) => {
    const { plcConnectionTone } = await import('../lib/plcUi');

    expect(plcConnectionTone(connection)).toBe(tone);
  });
});
