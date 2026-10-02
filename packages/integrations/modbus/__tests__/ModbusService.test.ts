import { readFileSync, mkdtempSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteDatabaseManager } from '../../../shared/infrastructure/database/SqliteDatabaseManager';
import { SQLiteDeviceRepository } from '../../../devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SQLiteHomeRepository } from '../../../topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteModbusRepository } from '../infrastructure/SQLiteModbusRepository';
import { ModbusService } from '../application/ModbusService';
import type { ModbusTransport } from '../application/ModbusPorts';
import { validateConnection, validateVariable, type ModbusConnection, type ModbusVariable } from '../domain/Modbus';
import { validateDeviceCommand } from '../../../devices/domain/CommandCapabilityValidator';

export function modbusFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'homepilot-modbus-'));
  const dbPath = join(directory, 'test.db');
  const db = SqliteDatabaseManager.getInstance(dbPath);
  for (const file of ['001_initial_schema.sql', '006_add_invert_state_to_devices.sql', '015_add_device_integration_source.sql', '022_add_semantic_type_to_devices.sql', '035_modbus_tcp.sql']) db.exec(readFileSync(join(process.cwd(), 'migrations', file), 'utf8'));
  db.prepare('INSERT INTO homes(id,owner_id,name) VALUES (?,?,?)').run('h', 'admin', 'Home');
  const repository = new SQLiteModbusRepository(dbPath), devices = new SQLiteDeviceRepository(dbPath), homes = new SQLiteHomeRepository(dbPath);
  const transport: jest.Mocked<ModbusTransport> = { read: jest.fn().mockResolvedValue(42), writeCoil: jest.fn().mockResolvedValue(undefined) };
  const publish = jest.fn(async (id: string, state: Record<string, unknown>) => { const device = await devices.findDeviceById(id); if (device) await devices.saveDevice({ ...device, lastKnownState: state }); });
  const service = new ModbusService(repository, transport, devices, homes, publish);
  const cleanup = () => { SqliteDatabaseManager.close(dbPath); for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory); };
  return { db, dbPath, repository, devices, transport, publish, service, cleanup };
}
describe('Feature: Modbus configuration, inventory and lifecycle (AC1/AC2/AC4/AC5/AC6)', () => {
  let f: ReturnType<typeof modbusFixture>;
  const connectionInput = { name: 'PLC', host: '192.168.1.5' };
  const variableInput = { name: 'Temperature', area: 'input_register', address: 100, dataType: 'int16', unit: '°C' };
  beforeEach(() => { f = modbusFixture(); });
  afterEach(async () => { if (f) { await f.service.stop(); f.cleanup(); } });
  async function create(enabled = true, writable = false): Promise<{ connection: ModbusConnection; variable: ModbusVariable }> {
    const connection = await f.service.saveConnection('admin', 'h', { ...connectionInput, enabled });
    const variable = await f.service.saveVariable('admin', connection.id, writable ? { name: 'Light', area: 'coil', address: 12, dataType: 'boolean', writable } : variableInput);
    return { connection, variable };
  }
  it('Scenario: Given new configuration When saved and reloaded Then connections and writes default off without network calls', async () => {
    const connection = await f.service.saveConnection('admin', 'h', connectionInput);
    const variable = await f.service.saveVariable('admin', connection.id, variableInput);
    expect(connection.enabled).toBe(false); expect(variable.writable).toBe(false);
    const reloaded = new SQLiteModbusRepository(f.dbPath); expect(reloaded.connection(connection.id)).toEqual(connection); expect(reloaded.variable(variable.deviceId)).toEqual(variable);
    await f.service.pollOnce(); expect(f.transport.read).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
  it.each(['127.0.0.1', '169.254.169.254', '8.8.8.8', 'localhost', '192.168.1.999', '192.168.1.255', '224.1.1.1', '192.168.01.5'])
    ('Scenario: Given prohibited endpoint %s When configured Then validation rejects before networking', async host => {
      await expect(f.service.saveConnection('admin', 'h', { ...connectionInput, host })).rejects.toMatchObject({ code: 'INVALID_CONFIG' }); expect(f.transport.read).not.toHaveBeenCalled();
    });
  it.each([{ unitId: 0 }, { unitId: 248 }, { timeoutMs: 100 }, { pollIntervalMs: 0 }, { port: 80 }, { enabled: 'true' }])
    ('Scenario: Given invalid bounds %j When configured Then validation fails', fields => expect(() => validateConnection({ ...connectionInput, ...fields })).toThrow());
  it.each([{ address: -1 }, { address: 1.5 }, { dataType: 'float32', address: 65535 }, { writable: true }, { scale: NaN }, { scale: 0 }, { wordOrder: 'invalid' }, { area: 'coil' }])
    ('Scenario: Given invalid map %j When configured Then validation fails', fields => expect(() => validateVariable({ ...variableInput, ...fields })).toThrow());
  it('Scenario: Given another home When listed or configured Then access fails closed', async () => {
    await expect(f.service.list('admin', 'other')).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.service.saveConnection('admin', 'other', connectionInput)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('Scenario: Given an assigned variable When edited Then room and external identity persist and old reading becomes stale', async () => {
    const { connection, variable } = await create();
    f.db.prepare('INSERT INTO rooms(id,home_id,name) VALUES (?,?,?)').run('room', 'h', 'Kitchen');
    const device = (await f.devices.findDeviceById(variable.deviceId))!;
    await f.devices.saveDevice({ ...device, roomId: 'room', status: 'ASSIGNED' });
    await f.service.saveVariable('admin', connection.id, { address: 101 }, variable.deviceId);
    expect(await f.devices.findDeviceById(variable.deviceId)).toMatchObject({ roomId: 'room', status: 'ASSIGNED', externalId: device.externalId, lastKnownState: { state: 'unavailable' } });
  });
  it('Scenario: Given inventory insert failure When mapping is saved Then no partial variable is persisted', async () => {
    const { variable } = await create();
    expect(() => f.repository.saveVariable({ ...variable, deviceId: 'bad' }, { ...(awaitedDevicePlaceholder()), id: 'bad', homeId: 'missing' })).toThrow();
    expect(f.repository.variable('bad')).toBeNull();
  });
  it('Scenario: Given read-only and disabled variables When commands are attempted Then no write occurs', async () => {
    const { variable } = await create(false);
    const device = (await f.devices.findDeviceById(variable.deviceId))!;
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: false, error: 'READ_ONLY' });
    expect(validateDeviceCommand(device, { name: 'turn_on' }).valid).toBe(false);
    const writable = await create(false, true); const writableDevice = (await f.devices.findDeviceById(writable.variable.deviceId))!;
    expect(await f.service.executeCommand(writableDevice, { name: 'turn_on' })).toMatchObject({ success: false, error: 'DISABLED' });
    expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
  it.each(['turn_on', 'turn_off', 'toggle'] as const)('Scenario: Given an enabled coil When %s executes Then existing Button commands use the native binding', async name => {
    const { variable, connection } = await create(true, true), device = (await f.devices.findDeviceById(variable.deviceId))!;
    f.transport.read.mockResolvedValue(false);
    expect(validateDeviceCommand(device, { name }).valid).toBe(true);
    expect(await f.service.executeCommand(device, { name })).toMatchObject({ success: true, newState: { state: 'off' } });
    expect(f.transport.writeCoil).toHaveBeenCalledWith(connection, 12, name !== 'turn_off');
  });
  it('Scenario: Given failed writing When command returns Then it is not retried and old value is unavailable', async () => {
    const { variable } = await create(true, true), device = (await f.devices.findDeviceById(variable.deviceId))!;
    f.transport.writeCoil.mockRejectedValue(new Error('timeout'));
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: false }); expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect((await f.devices.findDeviceById(device.id))?.lastKnownState).toMatchObject({ stale: true, state: 'unavailable' });
  });
  it('Scenario: Given a mismatched home or unsupported command When dispatched Then networking is denied', async () => {
    const { variable } = await create(true, true), device = (await f.devices.findDeviceById(variable.deviceId))!;
    expect(await f.service.executeCommand({ ...device, homeId: 'other' }, { name: 'turn_on' })).toMatchObject({ error: 'FORBIDDEN' });
    expect(await f.service.executeCommand(device, { name: 'press' })).toMatchObject({ success: false }); expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
  it('Scenario: Given a reading failure When polling Then value is retained as stale and reconnection uses backoff', async () => {
    const { variable } = await create();
    await f.service.pollOnce(0); expect((await f.devices.findDeviceById(variable.deviceId))?.lastKnownState).toMatchObject({ state: '42', stale: false });
    f.transport.read.mockRejectedValueOnce(new Error('offline'));
    await f.service.pollOnce(5000); expect((await f.devices.findDeviceById(variable.deviceId))?.lastKnownState).toMatchObject({ state: 'unavailable', value: 42, stale: true });
    await f.service.pollOnce(10000); expect(f.transport.read).toHaveBeenCalledTimes(2);
    await f.service.pollOnce(15000); expect(f.transport.read).toHaveBeenCalledTimes(3); expect((await f.devices.findDeviceById(variable.deviceId))?.lastKnownState).toMatchObject({ state: '42', stale: false });
  });
  it('Scenario: Given concurrent commands and polling When a read is in flight Then operations do not overlap', async () => {
    const { variable } = await create(true, true); const device = (await f.devices.findDeviceById(variable.deviceId))!;
    let release!: (value: boolean) => void, started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    f.transport.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); }));
    const polling = f.service.pollOnce(0); await reading;
    const command = f.service.executeCommand(device, { name: 'turn_on' });
    expect(f.transport.writeCoil).not.toHaveBeenCalled();
    release(false); await polling; await command; expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
  });
  it('Scenario: Given runtime start When stopped Then no poll timer remains', async () => {
    jest.useFakeTimers();
    try { f.service.start(); await f.service.stop(); await Promise.resolve(); expect(jest.getTimerCount()).toBe(0); } finally { jest.useRealTimers(); }
  });
  it('Scenario: Given an active poll When stop is requested Then the next variable is not contacted', async () => {
    const { connection } = await create(); await f.service.saveVariable('admin', connection.id, { ...variableInput, name: 'Second', address: 101 });
    let release!: (value: number) => void, started!: () => void;
    const reading = new Promise<void>(resolve => { started = resolve; });
    f.transport.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); }));
    f.service.start(); await reading;
    const stopping = f.service.stop(); release(42); await stopping;
    expect(f.transport.read).toHaveBeenCalledTimes(1);
  });
  it('Scenario: Given revoked write permission When an old Button binding executes Then driver denies writes', async () => {
    const { variable, connection } = await create(true, true); const device = (await f.devices.findDeviceById(variable.deviceId))!;
    await f.service.saveVariable('admin', connection.id, { writable: false }, device.id);
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: false, error: 'READ_ONLY' });
    expect(f.transport.writeCoil).not.toHaveBeenCalled();
    expect(validateDeviceCommand((await f.devices.findDeviceById(device.id))!, { name: 'turn_on' }).valid).toBe(false);
  });
});
function awaitedDevicePlaceholder() {
  return { id: '', homeId: 'h', roomId: null, externalId: 'bad', name: 'Bad', type: 'sensor', vendor: 'Modbus', status: 'PENDING' as const,
    integrationSource: 'modbus-tcp', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '' };
}
