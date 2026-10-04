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
import { convertModbusValue, ModbusError } from '../domain/Modbus';
import { createServer, type Socket } from 'node:net';
import type { AddressInfo } from 'node:net';
import { ModbusTcpClient } from '../infrastructure/ModbusTcpClient';
import { syncDeviceStateUseCase, type SyncDeviceStateDependencies } from '../../../devices/application/syncDeviceStateUseCase';
import { DeviceCommandService } from '../../../devices/application/DeviceCommandService';

describe('Feature: PLC I/O controller (AC20/AC21/AC22/AC23/AC25)', () => {
  let f: ReturnType<typeof modbusFixture>;
  const profileId = 'xinje-xl5e-16t-v2';
  beforeEach(() => { f = modbusFixture(); });
  afterEach(async () => { await f.service.stop(); f.cleanup(); });
  it.each([
    ['M100', 100, ['Y0']], ['M100', 100, ['Y0', 'Y1']], ['M101', 101, ['Y3', 'Y4']],
  ] as const)('Scenario: %s declarative destinations persist without extra reads or writes (AC37)', async (symbolicAddress, address, symbols) => {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', profileId, enabled: true });
    const v = await f.service.saveVariable('admin', c.id, { name: symbolicAddress, profileId, symbolicAddress, area: 'coil', address, dataType: 'boolean', writable: true,
      plc: { role: 'output_command', command: { profileId, symbolicAddress }, relatedPhysicalOutputs: symbols.map(symbol => ({ profileId, symbolicAddress: symbol })), feedbackPolicy: 'none' } });
    expect(new SQLiteModbusRepository(f.dbPath).variable(v.deviceId)?.plc).toEqual(v.plc);
    const device = (await f.devices.findDeviceById(v.deviceId))!;
    f.transport.read.mockResolvedValue(false);
    const result = await f.service.executeCommand(device, { name: 'turn_on' });
    expect(result).toMatchObject({ success: true, newState: { actualState: false, commandState: false } });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect(f.transport.writeCoil).toHaveBeenCalledWith(c, address, true);
    expect(f.transport.writeHoldingRegisters).not.toHaveBeenCalled();
    await f.service.pollOnce();
    expect(f.transport.read.mock.calls.every(call => call[1].address === address)).toBe(true);
    expect(f.repository.variable(v.deviceId)?.plc?.feedback).toBeUndefined();
    expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState?.actualState).toBe(false);
  });
  it.each(['auto', 'gauge', 'thermometer', 'level', 'battery'])('Scenario: %s visualization persists and reaches state sync without changing the device family (AC30)', async visualStyle => {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', enabled: true, host: '192.168.1.5' });
    const v = await f.service.saveVariable('admin', c.id, { name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16', visualStyle });
    expect(new SQLiteModbusRepository(f.dbPath).variable(v.deviceId)?.visualStyle).toBe(visualStyle);
    f.transport.read.mockResolvedValue(25); await f.service.pollOnce();
    expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState).toMatchObject({ state: '25', plcVisualStyle: visualStyle });
    expect((await f.devices.findDeviceById(v.deviceId))?.type).toBe('sensor');
  });
  it('Scenario: Historical visualization is absent and invalid/bit preferences are rejected (AC30)', () => {
    const numeric = { name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16' };
    expect(validateVariable(numeric)).not.toHaveProperty('visualStyle');
    expect(() => validateVariable({ ...numeric, visualStyle: 'scada' })).toThrow();
    expect(() => validateVariable({ ...numeric, area: 'coil', dataType: 'boolean', visualStyle: 'gauge' })).toThrow();
  });
  it('Scenario: Explicitly clearing visualization allows a numeric variable to become a read-only bit (AC30)', async () => {
    const connection = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5' });
    const variable = await f.service.saveVariable('admin', connection.id, { name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16', visualStyle: 'level' });
    const bit = await f.service.saveVariable('admin', connection.id, { name: 'Input', area: 'discrete_input', address: 0, dataType: 'boolean', visualStyle: null, scale: 1, offset: 0, writable: false }, variable.deviceId);
    expect(bit).not.toHaveProperty('visualStyle');
    expect(new SQLiteModbusRepository(f.dbPath).variable(variable.deviceId)).not.toHaveProperty('visualStyle');
  });
  it('Scenario: Connection loss retains last communication and exposes existing backoff only (AC28)', async () => {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', enabled: true, host: '192.168.1.5' });
    await f.service.saveVariable('admin', c.id, { name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16' });
    f.transport.read.mockResolvedValue(25); await f.service.pollOnce(1000);
    const before = (await f.service.list('admin', 'h'))[0].diagnostic?.lastReadAt;
    f.transport.read.mockRejectedValue(new ModbusError('TIMEOUT', 'private stack'));
    await f.service.pollOnce(10000);
    expect((await f.service.list('admin', 'h'))[0].diagnostic).toMatchObject({ status: 'unavailable', error: 'TIMEOUT', lastReadAt: before, retryAt: expect.any(String) });
  });
  async function output(extra: Record<string, unknown> = {}) {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', profileId, enabled: true });
    const v = await f.service.saveVariable('admin', c.id, { name: 'Garden light', profileId, symbolicAddress: 'M100', area: 'coil', address: 100, dataType: 'boolean', writable: true,
      plc: { role: 'output', command: { profileId, symbolicAddress: 'M100' }, physical: { profileId, symbolicAddress: 'Y0' }, feedback: { profileId, symbolicAddress: 'M200' }, feedbackPolicy: 'required', feedbackTimeoutMs: 250, ...extra } });
    return { c, v, device: (await f.devices.findDeviceById(v.deviceId))! };
  }
  it('Scenario: ON is written once to M100 and confirmed only through M200', async () => {
    const { c, v, device } = await output();
    f.transport.read.mockImplementation(async (_c, variable) => variable.address === 200);
    const result = await f.service.executeCommand(device, { name: 'turn_on' });
    expect(result).toMatchObject({ success: true, newState: { state: 'on', actualState: true, commandedState: true, confirmation: 'confirmed' } });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect(f.transport.writeCoil).toHaveBeenCalledWith(c, 100, true);
    expect(f.transport.read.mock.calls.every(call => call[1].address === 200)).toBe(true);
    expect(f.repository.variable(v.deviceId)?.plc?.feedback?.symbolicAddress).toBe('M200');
    const reloaded = new SQLiteModbusRepository(f.dbPath);
    expect(reloaded.variable(v.deviceId)?.plc).toEqual(v.plc);
  });
  it('Scenario: Declarative destinations do not replace configured independent feedback (AC37)', async () => {
    const { c, v, device } = await output({ role: 'output_command', physical: null, relatedPhysicalOutputs: ['Y0', 'Y1'].map(symbolicAddress => ({ profileId, symbolicAddress })) });
    f.transport.read.mockImplementation(async (_c, variable) => variable.address === 200);
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: true, newState: { actualState: true, feedbackState: true, confirmation: 'confirmed' } });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect(f.transport.writeCoil).toHaveBeenCalledWith(c, 100, true);
    expect(f.transport.read.mock.calls.every(call => call[1].address === 200)).toBe(true);
    expect(f.repository.variable(v.deviceId)?.plc?.feedback?.symbolicAddress).toBe('M200');
  });
  it('Scenario: Independent feedback OFF stays OFF and timeout does not repeat ON', async () => {
    const { device } = await output(); f.transport.read.mockResolvedValue(false);
    const result = await f.service.executeCommand(device, { name: 'turn_on' });
    expect(result).toMatchObject({ success: false, error: 'FEEDBACK_TIMEOUT' });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect((await f.devices.findDeviceById(device.id))?.lastKnownState).toMatchObject({ state: 'off', commandedState: true, actualState: false, confirmation: 'unconfirmed' });
    f.transport.read.mockResolvedValue(true); await f.service.pollOnce();
    expect((await f.devices.findDeviceById(device.id))?.lastKnownState).toMatchObject({ state: 'on', confirmation: 'confirmed' });
  });
  it('Scenario: Optional feedback mismatch is unconfirmed rather than optimistic ON', async () => {
    const { device } = await output({ feedbackPolicy: 'optional' });
    f.transport.read.mockImplementation(async (_c, variable) => variable.address === 100);
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: true, newState: { state: 'off', actualState: false, commandState: true, confirmation: 'unconfirmed' } });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
  });
  it('Scenario: Pulse performs bounded ON/OFF and exposes failed reset', async () => {
    const { device } = await output({ mode: 'pulse', pulseDurationMs: 100, feedbackPolicy: 'none', feedback: null });
    f.transport.read.mockResolvedValue(false);
    expect(await f.service.executeCommand(device, { name: 'press' })).toMatchObject({ success: true });
    expect(f.transport.writeCoil.mock.calls.map(call => call[2])).toEqual([true, false]);
    f.transport.writeCoil.mockReset(); f.transport.writeCoil.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('offline'));
    expect(await f.service.executeCommand(device, { name: 'pulse' })).toMatchObject({ success: false, error: 'RESET_FAILED' });
    expect((await f.devices.findDeviceById(device.id))?.lastKnownState?.confirmation).toBe('reset_failed');
  });
  it('Scenario: Ambiguous pulse ON still attempts OFF once', async () => {
    const { device } = await output({ mode: 'pulse', pulseDurationMs: 100, feedbackPolicy: 'none', feedback: null });
    f.transport.writeCoil.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(undefined);
    expect(await f.service.executeCommand(device, { name: 'pulse' })).toMatchObject({ success: false });
    expect(f.transport.writeCoil.mock.calls.map(call => call[2])).toEqual([true, false]);
  });
  it('Scenario: Connection loss during feedback marks actual unavailable and command unconfirmed', async () => {
    const { device } = await output();
    f.transport.read.mockRejectedValue(new ModbusError('TIMEOUT', 'PLC unreachable'));
    expect(await f.service.executeCommand(device, { name: 'turn_on' })).toMatchObject({ success: false, error: 'TIMEOUT' });
    expect(f.transport.writeCoil).toHaveBeenCalledTimes(1);
    expect((await f.devices.findDeviceById(device.id))?.lastKnownState).toMatchObject({ available: false, stale: true, confirmation: 'unconfirmed', commandedState: true });
  });
  it('Scenario: Setpoint limits block network and valid value uses inverse codec', async () => {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', enabled: true, profileId });
    const v = await f.service.saveVariable('admin', c.id, { name: 'Temperature target', area: 'holding_register', address: 100, profileId, symbolicAddress: 'D100', dataType: 'uint16', scale: 0.1, writable: true, plc: { role: 'setpoint', min: 5, max: 40 } });
    const device = (await f.devices.findDeviceById(v.deviceId))!;
    for (const value of [4, 41, NaN, Infinity]) expect(await f.service.executeCommand(device, { name: 'set_value', params: { value } })).toMatchObject({ success: false });
    expect(f.transport.writeHoldingRegisters).not.toHaveBeenCalled();
    f.transport.read.mockResolvedValue(22);
    expect(await f.service.executeCommand(device, { name: 'set_value', params: { value: 22 } })).toMatchObject({ success: true, newState: { value: 22 } });
    expect(f.transport.writeHoldingRegisters).toHaveBeenCalledWith(c, 100, [220]);
    for (const value of [5, 40]) expect(await f.service.executeCommand(device, { name: 'set_value', params: { value } })).toMatchObject({ success: true });
    expect(f.transport.writeHoldingRegisters.mock.calls.map(call => call[2])).toEqual([[220], [50], [400]]);
    expect(validateDeviceCommand(device, { name: 'set_value', params: { value: 22 } }).valid).toBe(true);
  });
  it('Scenario: Input changes through polling and one variable exception leaves others online', async () => {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', enabled: true });
    const input = await f.service.saveVariable('admin', c.id, { name: 'Door', area: 'coil', address: 20480, dataType: 'boolean', profileId, symbolicAddress: 'X0', plc: { role: 'input', physical: { profileId, symbolicAddress: 'X0' } } });
    const broken = await f.service.saveVariable('admin', c.id, { name: 'Broken', area: 'holding_register', address: 100, dataType: 'uint16' });
    f.transport.read.mockImplementation(async (_c, variable) => { if (variable.deviceId === broken.deviceId) throw new ModbusError('PROTOCOL', 'exception', 2); return false; });
    await f.service.pollOnce(1000);
    expect((await f.devices.findDeviceById(input.deviceId))?.lastKnownState?.state).toBe('off');
    f.transport.read.mockImplementation(async (_c, variable) => { if (variable.deviceId === broken.deviceId) throw new ModbusError('PROTOCOL', 'exception', 2); return true; });
    await f.service.pollOnce(7000);
    expect((await f.devices.findDeviceById(input.deviceId))?.lastKnownState?.state).toBe('on');
    f.transport.read.mockImplementation(async (_c, variable) => { if (variable.deviceId === broken.deviceId) throw new ModbusError('PROTOCOL', 'exception', 2); return false; });
    await f.service.pollOnce(13000);
    expect((await f.devices.findDeviceById(input.deviceId))?.lastKnownState?.state).toBe('off');
    expect((await f.devices.findDeviceById(broken.deviceId))?.lastKnownState?.state).toBe('unavailable');
    expect((await f.service.list('admin', 'h'))[0].diagnostic?.status).toBe('online');
  });
  it('Scenario: A conversion failure is isolated while another input remains online', async () => {
    const { c, v } = await output({ feedbackPolicy: 'none', feedback: null });
    const broken = await f.service.saveVariable('admin', c.id, { name: 'Invalid float', area: 'holding_register', address: 100, dataType: 'float32' });
    f.transport.read.mockImplementation(async (_connection, variable) => { if (variable.deviceId === broken.deviceId) throw new ModbusError('CONVERSION', 'Non-finite reading'); return false; });
    await f.service.pollOnce();
    expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState?.available).toBe(true);
    expect((await f.service.list('admin', 'h'))[0]).toMatchObject({ diagnostic: { status: 'online' }, variables: expect.arrayContaining([expect.objectContaining({ deviceId: broken.deviceId, diagnostic: expect.objectContaining({ status: 'variable_error', error: 'CONVERSION' }) })]) });
  });
  it('Scenario: Simulated PLC independent feedback reaches real dispatcher state sync and events (AC27)', async () => {
    const { c, v } = await output();
    let commanded = false, feedback = false;
    const requests: number[] = [], sockets = new Set<Socket>();
    const server = createServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      let bytes = Buffer.alloc(0);
      socket.on('data', chunk => {
        bytes = Buffer.concat([bytes, chunk]); if (bytes.length < 12) return;
        const fn = bytes[7], address = bytes.readUInt16BE(8); requests.push(address);
        let pdu: Buffer;
        if (fn === 5) { commanded = bytes.readUInt16BE(10) === 0xff00; pdu = bytes.subarray(7, 12); }
        else pdu = Buffer.from([1, 1, (address === 100 ? commanded : feedback) ? 1 : 0]);
        const response = Buffer.alloc(7 + pdu.length); bytes.copy(response, 0, 0, 7); response.writeUInt16BE(pdu.length + 1, 4); pdu.copy(response, 7); socket.end(response);
      });
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const events = jest.fn().mockResolvedValue(undefined), logs = jest.fn().mockResolvedValue(undefined);
    const deps: SyncDeviceStateDependencies = { deviceRepository: f.devices, eventPublisher: { publish: events }, activityLogRepository: { saveActivity: logs, findAllRecent: async () => [], findAllByTypes: async () => [], findRecentByDeviceId: async () => [] }, idGenerator: { generate: () => 'event-id' }, clock: { now: () => new Date().toISOString() } };
    // Test-only loopback transport; production configuration validation remains private-IP/502.
    const tcp = new ModbusTcpClient();
    const endpoint = (connection: ModbusConnection): ModbusConnection => ({ ...connection, host: '127.0.0.1', port: (server.address() as AddressInfo).port });
    const transport: ModbusTransport = { read: (connection, variable) => tcp.read(endpoint(connection), variable), readSample: (connection, variable) => tcp.readSample(endpoint(connection), variable), readRange: (connection, area, start, count, signal) => tcp.readRange(endpoint(connection), area, start, count, signal), writeCoil: (connection, address, value) => tcp.writeCoil(endpoint(connection), address, value), writeHoldingRegisters: (connection, address, words) => tcp.writeHoldingRegisters(endpoint(connection), address, words) };
    const service = new ModbusService(f.repository, transport, f.devices, new SQLiteHomeRepository(f.dbPath), (id, state) => syncDeviceStateUseCase(id, state, 'plc-e2e', deps));
    const dispatcher = new DeviceCommandService(f.devices, { register: () => undefined, resolve: () => service }, deps);
    try {
      await service.pollOnce();
      expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState?.state).toBe('off');
      await expect(dispatcher.dispatch(v.deviceId, 'turn_on')).rejects.toThrow('FEEDBACK_TIMEOUT');
      expect(commanded).toBe(true);
      expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState).toMatchObject({ state: 'off', actualState: false, commandedState: true });
      feedback = true; await service.pollOnce(Date.now() + 6000);
      expect((await f.devices.findDeviceById(v.deviceId))?.lastKnownState).toMatchObject({ state: 'on', actualState: true, confirmation: 'confirmed' });
      expect(events.mock.calls.some(([event]) => event.eventType === 'DeviceStateUpdatedEvent')).toBe(true);
      expect(logs).toHaveBeenCalled(); expect(requests).toContain(200); expect(requests).toContain(24576);
      expect((await service.list('admin', 'h'))[0].variables[0].diagnostic?.raw).toBeDefined();
    } finally { await service.stop(); for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); }
  });
});

export function modbusFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'homepilot-modbus-'));
  const dbPath = join(directory, 'test.db');
  const db = SqliteDatabaseManager.getInstance(dbPath);
  for (const file of ['001_initial_schema.sql', '006_add_invert_state_to_devices.sql', '015_add_device_integration_source.sql', '022_add_semantic_type_to_devices.sql', '035_modbus_tcp.sql']) db.exec(readFileSync(join(process.cwd(), 'migrations', file), 'utf8'));
  db.prepare('INSERT INTO homes(id,owner_id,name) VALUES (?,?,?)').run('h', 'admin', 'Home');
  const repository = new SQLiteModbusRepository(dbPath), devices = new SQLiteDeviceRepository(dbPath), homes = new SQLiteHomeRepository(dbPath);
  const transport: jest.Mocked<ModbusTransport> = { readRange: jest.fn().mockResolvedValue([42]), read: jest.fn().mockResolvedValue(42), writeCoil: jest.fn().mockResolvedValue(undefined), writeHoldingRegisters: jest.fn().mockResolvedValue(undefined) };
  const publish = jest.fn(async (id: string, state: Record<string, unknown>) => { const device = await devices.findDeviceById(id); if (device) await devices.saveDevice({ ...device, lastKnownState: state }); });
  const service = new ModbusService(repository, transport, devices, homes, publish);
  const cleanup = () => { SqliteDatabaseManager.close(dbPath); for (const name of readdirSync(directory)) unlinkSync(join(directory, name)); rmdirSync(directory); };
  return { db, dbPath, repository, devices, transport, publish, service, cleanup };
}

describe('Feature: Dashboard priority polling (AC36)', () => {
  let f: ReturnType<typeof modbusFixture>;
  beforeEach(() => { f = modbusFixture(); f.db.exec('CREATE TABLE dashboards(id TEXT PRIMARY KEY,tabs TEXT)'); });
  afterEach(async () => { await f.service.stop(); f.cleanup(); });
  async function mapped() {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', enabled: true, pollIntervalMs: 5000 });
    const ordinary = await f.service.saveVariable('admin', c.id, { name: 'Ordinary', area: 'holding_register', address: 110, dataType: 'uint16' });
    const priority = await f.service.saveVariable('admin', c.id, { name: 'Dashboard', area: 'holding_register', address: 100, dataType: 'uint16' });
    f.db.prepare('INSERT INTO dashboards VALUES (?,?)').run('d', JSON.stringify([{ widgets: [{ config: { extra: { cards: [{ entityId: priority.deviceId }] } } }] }]));
    return { c, priority, ordinary };
  }
  it('reads dashboard variables first every second, others at configured cadence, without writes', async () => {
    const { priority, ordinary } = await mapped();
    await f.service.pollOnce(0);
    expect(f.transport.read.mock.calls.map(call => call[1].deviceId)).toEqual([priority.deviceId, ordinary.deviceId]);
    f.transport.read.mockClear();
    await f.service.pollOnce(500); expect(f.transport.read).not.toHaveBeenCalled();
    await f.service.pollOnce(1000); expect(f.transport.read.mock.calls.map(call => call[1].deviceId)).toEqual([priority.deviceId]);
    f.transport.read.mockClear(); await f.service.pollOnce(5000);
    expect(f.transport.read.mock.calls.map(call => call[1].deviceId)).toEqual([priority.deviceId, ordinary.deviceId]);
    expect(f.transport.writeCoil).not.toHaveBeenCalled(); expect(f.transport.writeHoldingRegisters).not.toHaveBeenCalled();
  });
  it('releases priority when the binding is removed, without rewriting historical configuration', async () => {
    const { c } = await mapped(); const before = f.repository.connection(c.id);
    await f.service.pollOnce(0); f.transport.read.mockClear(); f.db.prepare('DELETE FROM dashboards').run();
    await f.service.pollOnce(1000); expect(f.transport.read).not.toHaveBeenCalled();
    expect(f.repository.connection(c.id)).toEqual(before);
  });
  it('does not bypass backoff or disabled connections', async () => {
    const { c } = await mapped(); await f.service.pollOnce(0);
    f.transport.read.mockRejectedValue(new ModbusError('TIMEOUT', 'fixture')); await f.service.pollOnce(1000);
    f.transport.read.mockClear(); await f.service.pollOnce(2000); expect(f.transport.read).not.toHaveBeenCalled();
    await f.service.saveConnection('admin', 'h', { ...c, enabled: false }, c.id);
    await f.service.pollOnce(30000); expect(f.transport.read).not.toHaveBeenCalled();
  });
  it('collects exact nested bindings, ignores names and supports historical prefixed IDs', async () => {
    const { priority, ordinary } = await mapped();
    f.db.prepare('UPDATE dashboards SET tabs=?').run(JSON.stringify([{ widgets: [{ config: { binding: { entityId: `modbus:${priority.deviceId}` }, extra: { cards: [{ title: ordinary.deviceId }] } } }] }]));
    expect([...f.repository.dashboardDeviceIds()]).toEqual([priority.deviceId]);
  });
  it('shares the connection queue and does not overlap slow reads', async () => {
    await mapped(); let release!: (value: number) => void;
    f.transport.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const pending = f.service.pollOnce(0);
    while (!release) await Promise.resolve();
    await f.service.pollOnce(1000); expect(f.transport.read).toHaveBeenCalledTimes(1);
    release(42); await pending;
  });
});
describe('Feature: Safe Modbus deletion (AC18)', () => {
  let f: ReturnType<typeof modbusFixture>;
  beforeEach(() => { f = modbusFixture(); });
  afterEach(async () => { await f.service.stop(); f.cleanup(); });
  async function create() {
    const c = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', enabled: true });
    const v = await f.service.saveVariable('admin', c.id, { name: 'Reading', area: 'holding_register', address: 100, dataType: 'uint16' });
    return { c, v };
  }
  it('Scenario: Variables must be deleted before their connection, with no physical writes', async () => {
    const { c, v } = await create();
    await expect(f.service.deleteConnection('admin', c.id)).rejects.toMatchObject({ code: 'IN_USE' });
    await f.service.deleteVariable('admin', c.id, v.deviceId);
    expect(f.repository.variable(v.deviceId)).toBeNull(); expect(await f.devices.findDeviceById(v.deviceId)).toBeNull();
    await f.service.deleteConnection('admin', c.id); await f.service.pollOnce();
    expect(f.repository.connection(c.id)).toBeNull(); expect(f.transport.read).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
  it('Scenario: Inaccessible home and wrong connection cannot delete a variable', async () => {
    const { c, v } = await create();
    const access = jest.spyOn(SQLiteHomeRepository.prototype, 'findHomesByUserId').mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await expect(f.service.deleteVariable('other', c.id, v.deviceId)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(f.service.deleteConnection('other', c.id)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    access.mockRestore();
    const other = await f.service.saveConnection('admin', 'h', { name: 'Other', host: '192.168.1.6' });
    await expect(f.service.deleteVariable('admin', other.id, v.deviceId)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f.repository.variable(v.deviceId)).not.toBeNull();
  });
  it.each(['scene', 'trigger', 'action', 'dashboard'])('Scenario: %s nested binding blocks deletion atomically', async kind => {
    const { c, v } = await create();
    const binding = JSON.stringify({ nested: [{ deviceId: kind === 'dashboard' ? `modbus:${v.deviceId}` : v.deviceId }] });
    if (kind === 'scene') {
      f.db.exec('CREATE TABLE scenes (actions TEXT)'); f.db.prepare('INSERT INTO scenes VALUES (?)').run(binding);
    } else if (kind === 'dashboard') {
      f.db.exec('CREATE TABLE dashboards (tabs TEXT)'); f.db.prepare('INSERT INTO dashboards VALUES (?)').run(binding);
    } else {
      f.db.prepare('INSERT INTO automation_rules(id,home_id,user_id,name,trigger,action) VALUES (?,?,?,?,?,?)').run('a', 'h', 'admin', 'Rule', kind === 'trigger' ? binding : '{}', kind === 'action' ? binding : '{}');
    }
    await expect(f.service.deleteVariable('admin', c.id, v.deviceId)).rejects.toMatchObject({ code: 'IN_USE' });
    expect(f.repository.variable(v.deviceId)).not.toBeNull(); expect(await f.devices.findDeviceById(v.deviceId)).not.toBeNull();
  });
});
describe('Feature: Profile resolution and persistence (AC12/AC13/AC14)', () => {
  let f: ReturnType<typeof modbusFixture>;
  const profileId = 'xinje-xl5e-16t-v1';
  beforeEach(() => { f = modbusFixture(); });
  afterEach(async () => { await f.service.stop(); f.cleanup(); });
  it.each(['generic', 'xinje-xl5e-16t-v1', 'xinje-xl5e-16t-v2'])('Scenario: Historical %s JSON loads without rewriting or changing permissions (AC33)', async revision => {
    const profileId = revision === 'generic' ? undefined : revision;
    const c = await f.service.saveConnection('admin', 'h', { name: 'Historical PLC', host: '192.168.1.5', profileId });
    const v = await f.service.saveVariable('admin', c.id, { name: 'Historical reading', area: 'holding_register', address: 100, dataType: 'uint16', ...(profileId ? { profileId, symbolicAddress: 'D100' } : {}) });
    const connectionJson = JSON.stringify({ name: c.name, host: c.host, port: 502, unitId: 1, timeoutMs: 2000, pollIntervalMs: 5000, enabled: false, ...(profileId ? { profileId, moduleCapacities: { CPU: { inputs: 8, outputs: 8 } } } : {}) });
    const variableJson = JSON.stringify({ name: v.name, area: 'holding_register', address: 100, dataType: 'uint16', wordOrder: 'high_first', scale: 1, offset: 0, unit: '', writable: revision.endsWith('-v2'), ...(profileId ? { profileId, symbolicAddress: 'D100' } : {}),
      ...(revision.endsWith('-v2') ? { plc: { role: 'setpoint', min: 0, max: 100, feedbackPolicy: 'none', feedbackTimeoutMs: 2000, mode: 'sustained', pulseDurationMs: 500 } } : {}) });
    f.db.prepare('UPDATE modbus_connections SET config=? WHERE id=?').run(connectionJson, c.id);
    f.db.prepare('UPDATE modbus_variables SET config=? WHERE device_id=?').run(variableJson, v.deviceId);
    const repository = new SQLiteModbusRepository(f.dbPath);
    expect(repository.connection(c.id)).toMatchObject(JSON.parse(connectionJson));
    expect(repository.variable(v.deviceId)).toMatchObject(JSON.parse(variableJson));
    expect(f.db.prepare('SELECT config FROM modbus_connections WHERE id=?').get(c.id)).toEqual({ config: connectionJson });
    expect(f.db.prepare('SELECT config FROM modbus_variables WHERE device_id=?').get(v.deviceId)).toEqual({ config: variableJson });
    expect(f.transport.read).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled(); expect(f.transport.writeHoldingRegisters).not.toHaveBeenCalled();
  });
  it('Scenario: Symbol to probe RAW to shared decoder to persistence preserves generic effective address', async () => {
    f.transport.readRange.mockResolvedValue([0x41b4, 0]);
    const result = await f.service.probe('admin', 'h', { host: '192.168.1.5', profileId, symbolicStart: 'D100', symbolicEnd: 'D101' });
    expect(f.transport.readRange).toHaveBeenCalledWith(expect.anything(), 'holding_register', 100, 2, undefined);
    expect(result.rows[0]).toMatchObject({ address: 100, symbolicAddress: 'D100', area: 'holding_register', raw: 0x41b4 });
    const connection = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', profileId, moduleCapacities: { CPU: { inputs: 8, outputs: 8 } } });
    const variable = await f.service.saveVariable('admin', connection.id, { name: 'D100', profileId, symbolicAddress: 'D100', area: 'holding_register', address: 100, dataType: 'float32', scale: 0.1, offset: 2 });
    expect(convertModbusValue(result.rows.map(row => row.raw!), variable)).toBe(4.25);
    const reloaded = new SQLiteModbusRepository(f.dbPath);
    expect(reloaded.connection(connection.id)).toEqual(connection); expect(reloaded.variable(variable.deviceId)).toEqual(variable);
    expect(f.transport.writeCoil).not.toHaveBeenCalled(); expect(f.publish).not.toHaveBeenCalled();
  });
  it.each([{ profileId: 'unknown', symbolicStart: 'D100', symbolicEnd: 'D101' }, { profileId, symbolicStart: 'X8', symbolicEnd: 'X10' }, { profileId, symbolicStart: 'D100', symbolicEnd: 'D101', start: 999 }, { symbolicStart: 'D100', symbolicEnd: 'D101' }])
    ('Scenario: Invalid metadata %j cannot contact the PLC', async fields => {
      await expect(f.service.probe('admin', 'h', { host: '192.168.1.5', ...fields })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
      expect(f.transport.readRange).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled();
    });
  it('Scenario: Saved physical capacity cannot be bypassed by probe or variable creation or invalidated by editing connection', async () => {
    const connection = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5', profileId, moduleCapacities: { CPU: { inputs: 8, outputs: 8 } } });
    await expect(f.service.probe('admin', 'h', { host: connection.host, profileId, symbolicStart: 'X0', symbolicEnd: 'X10', moduleCapacities: { CPU: { inputs: 64, outputs: 64 } } })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await expect(f.service.saveVariable('admin', connection.id, { name: 'X10', profileId, symbolicAddress: 'X10', area: 'coil', address: 20488, dataType: 'boolean' })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    await f.service.saveVariable('admin', connection.id, { name: 'X7', profileId, symbolicAddress: 'X7', area: 'coil', address: 20487, dataType: 'boolean' });
    await expect(f.service.saveConnection('admin', 'h', { ...connection, moduleCapacities: { CPU: { inputs: 4, outputs: 8 } } }, connection.id)).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    expect(f.transport.readRange).not.toHaveBeenCalled();
  });
  it.each(['SM5', 'X0', 'T0', 'C0', 'HT0', 'HC0'])('Scenario: Protected %s cannot opt into write', async symbolicAddress => {
    const connection = await f.service.saveConnection('admin', 'h', { name: 'PLC', host: '192.168.1.5' });
    const { resolveModbusAddress } = await import('../domain/ModbusAddressProfile');
    const resolved = resolveModbusAddress(profileId, symbolicAddress);
    await expect(f.service.saveVariable('admin', connection.id, { name: symbolicAddress, profileId, symbolicAddress, area: resolved.area, address: resolved.address, dataType: 'boolean', writable: true })).rejects.toMatchObject({ code: 'INVALID_CONFIG' });
    expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
});
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
  it('Scenario: Given no saved connection When an Admin tests a range Then RAW rows return without inventory or writes', async () => {
    f.transport.readRange.mockResolvedValue([65535, 22, 1]);
    const result = await f.service.probe('admin', 'h', { ...connectionInput, area: 'holding_register', start: 100, end: 102 });
    expect(result.rows).toEqual([65535, 22, 1].map((raw, i) => ({ address: 100 + i, raw, status: 'ok', elapsedMs: expect.any(Number) })));
    expect(f.repository.connections()).toEqual([]); expect(f.publish).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled();
  });
  it.each([{ start: -1 }, { end: 164 }, { end: 99 }, { host: '127.0.0.1' }, { unitId: 0 }, { area: 'write' }, { writable: true }, { timeoutMs: 10000 }])
    ('Scenario: Given invalid discovery %j When tested Then networking is rejected', async invalid => {
      await expect(f.service.probe('admin', 'h', { ...connectionInput, area: 'holding_register', start: 100, end: 120, ...invalid })).rejects.toBeDefined();
      expect(f.transport.readRange).not.toHaveBeenCalled(); expect(f.transport.writeCoil).not.toHaveBeenCalled();
    });
  it('Scenario: Given a foreign home When probing Then no address is contacted', async () => {
    await expect(f.service.probe('admin', 'other', { ...connectionInput, area: 'coil', start: 0, end: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(f.transport.readRange).not.toHaveBeenCalled();
  });
  it('Scenario: Given a failed block When probing Then every address reports the same bounded error without invented RAW', async () => {
    f.transport.readRange.mockRejectedValue(new Error('Private transport detail'));
    const result = await f.service.probe('admin', 'h', { ...connectionInput, area: 'input_register', start: 100, end: 101 });
    expect(result.rows).toHaveLength(2); expect(result.rows[0]).toMatchObject({ raw: null, status: 'error', error: 'CONNECTION' });
    expect(JSON.stringify(result)).not.toContain('Private transport detail');
  });
  it('Scenario: Given an active probe When another starts Then reads do not overlap and cancellation cleans the lock', async () => {
    let release!: () => void, started!: () => void;
    const begun = new Promise<void>(resolve => { started = resolve; });
    const controller = new AbortController();
    f.transport.readRange.mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([42]); started(); }));
    const input = { ...connectionInput, area: 'holding_register', start: 100, end: 100 };
    const first = f.service.probe('admin', 'h', input, controller.signal); await begun;
    await expect(f.service.probe('admin', 'h', input)).rejects.toMatchObject({ code: 'LIMIT' });
    controller.abort(); release(); await expect(first).rejects.toMatchObject({ code: 'CANCELLED' });
    await expect(f.service.probe('admin', 'h', input)).resolves.toHaveProperty('rows');
  });
  it('Scenario: Given existing polling When testing its endpoint Then probe waits for the same connection queue', async () => {
    await create(); let release!: (value: number) => void, started!: () => void;
    const begun = new Promise<void>(resolve => { started = resolve; });
    f.transport.read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; started(); }));
    const poll = f.service.pollOnce(0); await begun;
    const probe = f.service.probe('admin', 'h', { ...connectionInput, area: 'holding_register', start: 100, end: 100 });
    expect(f.transport.readRange).not.toHaveBeenCalled(); release(42); await poll; await probe;
    expect(f.transport.readRange).toHaveBeenCalledTimes(1);
  });
  it.each(['uint32', 'int32'])('Scenario: Given %s When saved and reloaded Then the new JSON type persists without SQL migration', async dataType => {
    const { connection } = await create(false);
    const variable = await f.service.saveVariable('admin', connection.id, { ...variableInput, dataType });
    expect(new SQLiteModbusRepository(f.dbPath).variable(variable.deviceId)).toMatchObject({ dataType, writable: false });
  });
});
function awaitedDevicePlaceholder() {
  return { id: '', homeId: 'h', roomId: null, externalId: 'bad', name: 'Bad', type: 'sensor', vendor: 'Modbus', status: 'PENDING' as const,
    integrationSource: 'modbus-tcp', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '' };
}
