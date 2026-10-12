import { isPlcIntegration, integrationInfo } from '../../../devices/domain/integrationCatalog';
import { SQLiteHomeRepository } from '../../../topology/infrastructure/repositories/SQLiteHomeRepository';
import { ModbusError, validateConnection } from '../domain/Modbus';
import { DEFAULT_PLC_PROTOCOL, PLC_PROTOCOLS, isPlcProtocolId } from '../domain/PlcProtocol';
import { ModbusService } from '../application/ModbusService';
import type { ModbusTransport } from '../application/ModbusPorts';
import { DefaultPlcTransportRegistry } from '../infrastructure/DefaultPlcTransportRegistry';
import { modbusFixture } from './modbusFixture';

const settings = { name: 'PLC', host: '192.168.1.5', enabled: true };
const fakeTransport = (): ModbusTransport => ({
  readRange: jest.fn(), read: jest.fn(), writeCoil: jest.fn(), writeHoldingRegisters: jest.fn(),
});

describe('Feature: a PLC connection names its protocol', () => {
  it('Scenario: Given a connection without a protocol When validated Then it is Modbus TCP, as every connection saved before was', () => {
    expect(validateConnection(settings).protocol).toBe('modbus-tcp');
    expect(validateConnection({ ...settings, protocol: null }).protocol).toBe(DEFAULT_PLC_PROTOCOL);
  });

  it('Scenario: Given a known protocol When validated Then it is kept', () => {
    expect(validateConnection({ ...settings, protocol: 'modbus-tcp' }).protocol).toBe('modbus-tcp');
  });

  it.each([['opc-ua'], [''], [7], [{}]])('Scenario: Given the protocol %p When validated Then it is refused', (protocol) => {
    expect(() => validateConnection({ ...settings, protocol })).toThrow(ModbusError);
    expect(isPlcProtocolId(protocol)).toBe(false);
  });

  it('Scenario: Given every protocol the system knows When looked up in the catalog Then each is a PLC integration with a name', () => {
    for (const protocol of PLC_PROTOCOLS) {
      expect(isPlcIntegration(protocol)).toBe(true);
      expect(integrationInfo(protocol)?.name.length).toBeGreaterThan(0);
    }
  });
});

describe('Feature: the transport comes from the protocol registry', () => {
  it('Scenario: Given a registered protocol When asked Then its own transport comes back', () => {
    const transport = fakeTransport();
    expect(new DefaultPlcTransportRegistry().register('modbus-tcp', transport).transportFor('modbus-tcp')).toBe(transport);
  });

  it('Scenario: Given a protocol nobody registered When asked Then it is a configuration error, not a silent fallback', () => {
    expect(() => new DefaultPlcTransportRegistry().transportFor('modbus-tcp')).toThrow(ModbusError);
  });
});

describe('Feature: the service works through the protocol of each connection', () => {
  let f: ReturnType<typeof modbusFixture>;
  beforeEach(() => { f = modbusFixture(); });
  afterEach(async () => { await f.service.stop(); f.cleanup(); });

  it('Scenario: Given a stored connection that predates the protocol When read Then it is Modbus TCP', () => {
    f.db.prepare('INSERT INTO modbus_connections(id,home_id,config) VALUES (?,?,?)').run('old', 'h',
      JSON.stringify({ name: 'Old PLC', host: '192.168.1.9', port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: false }));
    expect(f.repository.connection('old')?.protocol).toBe('modbus-tcp');
  });

  it('Scenario: Given a new connection When saved Then the protocol is stored with it and the variables become devices of that protocol', async () => {
    const connection = await f.service.saveConnection('admin', 'h', settings);
    expect(JSON.parse((f.db.prepare('SELECT config FROM modbus_connections WHERE id=?').get(connection.id) as { config: string }).config).protocol).toBe('modbus-tcp');
    const variable = await f.service.saveVariable('admin', connection.id, { name: 'Nivel', area: 'holding_register', address: 100, dataType: 'uint16' });
    expect(await f.devices.findDeviceById(variable.deviceId)).toMatchObject({ integrationSource: 'modbus-tcp', vendor: 'Modbus TCP' });
  });

  it('Scenario: Given a reading When the service uses a connection Then it asks the registry for that connection\'s protocol', async () => {
    const transportFor = jest.fn(() => f.transport);
    const service = new ModbusService(f.repository, { transportFor }, f.devices, new SQLiteHomeRepository(f.dbPath), f.publish);
    await service.probe('admin', 'h', { host: '192.168.1.5', unitId: 1, area: 'holding_register', start: 100, end: 100 });
    expect(transportFor).toHaveBeenCalledWith('modbus-tcp');
    await service.stop();
  });

  it('Scenario: Given the devices of a PLC protocol When asked Then the service supports them and nobody else\'s', () => {
    expect(f.service.supports({ integrationSource: 'modbus-tcp' } as never)).toBe(true);
    expect(f.service.supports({ integrationSource: 'sonoff' } as never)).toBe(false);
  });
});
