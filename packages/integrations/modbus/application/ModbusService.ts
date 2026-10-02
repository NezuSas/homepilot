import { randomUUID } from 'node:crypto';
import type { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { DeviceDriver, DeviceDriverCommand, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import type { Device } from '../../../devices/domain/types';
import { ModbusError, validateConnection, validateVariable, type ModbusConnection, type ModbusVariable, type ModbusProbeResult } from '../domain/Modbus';
import { resolveModbusRange, validateProfileMapping } from '../domain/ModbusAddressProfile';
import { modbusWordCount } from '../domain/Modbus';
import type { ModbusRepository, ModbusTransport } from './ModbusPorts';

export class ModbusService implements DeviceDriver {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly pending = new Map<string, number>();
  private readonly schedule = new Map<string, { due: number; failures: number }>();
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private cycle?: Promise<void>;
  private readonly probes = new Set<string>();
  constructor(private readonly repository: ModbusRepository, private readonly transport: ModbusTransport,
    private readonly devices: DeviceRepository, private readonly homes: HomeRepository,
    private readonly publishState: (deviceId: string, state: Record<string, unknown>) => Promise<void>) {}

  private async authorize(userId: string, homeId: string): Promise<void> {
    if (!(await this.homes.findHomesByUserId(userId)).some(h => h.id === homeId)) throw new ModbusError('FORBIDDEN', 'Home is not accessible');
  }
  private requireConnection(id: string): ModbusConnection {
    const connection = this.repository.connection(id);
    if (!connection) throw new ModbusError('NOT_FOUND', 'Modbus connection not found');
    return connection;
  }
  private serialize<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const count = this.pending.get(id) ?? 0;
    if (count >= 32) return Promise.reject(new ModbusError('LIMIT', 'Modbus queue is busy'));
    this.pending.set(id, count + 1);
    const promise = (this.queues.get(id) ?? Promise.resolve()).catch(() => undefined).then(operation);
    this.queues.set(id, promise);
    void promise.finally(() => {
      const remaining = (this.pending.get(id) ?? 1) - 1;
      if (remaining === 0) this.pending.delete(id); else this.pending.set(id, remaining);
      if (this.queues.get(id) === promise) this.queues.delete(id);
    }).catch(() => undefined);
    return promise;
  }
  async list(userId: string, homeId: string) {
    await this.authorize(userId, homeId);
    return this.repository.connections(homeId).map(connection => ({ ...connection, variables: this.repository.variables(connection.id) }));
  }
  async probe(userId: string, homeId: string, input: Record<string, unknown>, signal?: AbortSignal): Promise<ModbusProbeResult> {
    await this.authorize(userId, homeId);
    const settings = validateConnection({ ...input, name: 'Read test', enabled: false });
    if (settings.timeoutMs > 5000) throw new ModbusError('INVALID_CONFIG', 'Probe timeout exceeded');
    const match = this.repository.connections(homeId).find(c => c.host === settings.host && c.unitId === settings.unitId);
    let resolved: ReturnType<typeof resolveModbusRange> | undefined;
    if (settings.profileId) {
      try {
        if (typeof input.symbolicStart !== 'string' || typeof input.symbolicEnd !== 'string') throw new Error();
        resolved = resolveModbusRange(settings.profileId, input.symbolicStart, input.symbolicEnd, match?.moduleCapacities ?? settings.moduleCapacities);
        if ((input.area !== undefined && input.area !== resolved[0].area) || (input.start !== undefined && input.start !== resolved[0].address) || (input.end !== undefined && input.end !== resolved[resolved.length - 1].address)) throw new Error();
      } catch { throw new ModbusError('INVALID_CONFIG', 'Invalid symbolic range'); }
    } else if (input.symbolicStart != null || input.symbolicEnd != null) throw new ModbusError('INVALID_CONFIG', 'Profile required');
    const area = resolved?.[0].area ?? input.area;
    const map = validateVariable({ name: 'Read test', area, address: resolved?.[0].address ?? input.start, dataType: area === 'coil' || area === 'discrete_input' ? 'boolean' : 'uint16', scale: 1, offset: 0, writable: false });
    const end = resolved?.[resolved.length - 1].address ?? input.end;
    if (typeof end !== 'number' || !Number.isInteger(end) || end < map.address || end > 65535 || end - map.address >= 64) throw new ModbusError('INVALID_CONFIG', 'Invalid read range');
    if (input.writable === true) throw new ModbusError('READ_ONLY', 'Discovery is read-only');
    if (this.probes.has(homeId)) throw new ModbusError('LIMIT', 'A probe is already running');
    this.probes.add(homeId);
    const connection: ModbusConnection = { ...settings, id: match?.id ?? `probe:${homeId}:${settings.host}:${settings.unitId}`, homeId };
    try {
      return await this.serialize(connection.id, async () => {
        if (signal?.aborted) throw new ModbusError('CANCELLED', 'Read cancelled');
        const started = Date.now();
        try {
          const raw = await this.transport.readRange(connection, map.area, map.address, end - map.address + 1, signal);
          if (signal?.aborted) throw new ModbusError('CANCELLED', 'Read cancelled');
          if (raw.length !== end - map.address + 1) throw new ModbusError('PROTOCOL', 'Incomplete read');
          return { sampledAt: new Date().toISOString(), rows: raw.map((value, i) => ({ address: map.address + i, raw: value, status: 'ok' as const, elapsedMs: Date.now() - started, ...(resolved ? { symbolicAddress: resolved[i].symbolicAddress, area: map.area } : {}) })) };
        } catch (error: unknown) {
          if (signal?.aborted || (error instanceof ModbusError && error.code === 'CANCELLED')) throw new ModbusError('CANCELLED', 'Read cancelled');
          return { sampledAt: new Date().toISOString(), rows: Array.from({ length: end - map.address + 1 }, (_, i) => ({ address: map.address + i, raw: null, status: 'error' as const, elapsedMs: Date.now() - started, error: error instanceof ModbusError ? error.code : 'CONNECTION', ...(error instanceof ModbusError && error.exceptionCode !== undefined ? { exceptionCode: error.exceptionCode } : {}), ...(resolved ? { symbolicAddress: resolved[i].symbolicAddress, area: map.area } : {}) })) };
        }
      });
    } finally { this.probes.delete(homeId); }
  }
  async saveConnection(userId: string, homeId: string, input: Record<string, unknown>, id?: string): Promise<ModbusConnection> {
    await this.authorize(userId, homeId);
    const existing = id ? this.requireConnection(id) : null;
    if (existing && existing.homeId !== homeId) throw new ModbusError('FORBIDDEN', 'Home is not accessible');
    const connection = { ...validateConnection({ ...existing, ...input }), id: existing?.id ?? randomUUID(), homeId };
    return this.serialize(connection.id, async () => {
      if (existing) this.requireConnection(connection.id);
      if (existing) {
        try { for (const variable of this.repository.variables(existing.id)) validateProfileMapping(variable, modbusWordCount(variable.dataType), connection.moduleCapacities); }
        catch { throw new ModbusError('INVALID_CONFIG', 'Capacity would invalidate an existing variable'); }
      }
      if (!existing && this.repository.connections(homeId).length >= 16) throw new ModbusError('LIMIT', 'Too many Modbus connections');
      this.repository.saveConnection(connection); this.schedule.delete(connection.id);
      if (!connection.enabled || (existing && (existing.host !== connection.host || existing.unitId !== connection.unitId))) await this.markUnavailable(connection.id);
      return connection;
    });
  }
  async saveVariable(userId: string, connectionId: string, input: Record<string, unknown>, deviceId?: string): Promise<ModbusVariable> {
    const connection = this.requireConnection(connectionId);
    await this.authorize(userId, connection.homeId);
    return this.serialize(connectionId, async () => {
      this.requireConnection(connectionId);
      const existing = deviceId ? this.repository.variable(deviceId) : null;
      if (deviceId && (!existing || existing.connectionId !== connectionId)) throw new ModbusError('NOT_FOUND', 'Modbus variable not found');
      if (!existing && this.repository.variables(connectionId).length >= 128) throw new ModbusError('LIMIT', 'Too many Modbus variables');
      const variable: ModbusVariable = { ...validateVariable({ ...existing, ...input }), deviceId: deviceId ?? randomUUID(), connectionId };
      try { validateProfileMapping(variable, modbusWordCount(variable.dataType), this.requireConnection(connectionId).moduleCapacities); } catch { throw new ModbusError('INVALID_CONFIG', 'Invalid profile mapping'); }
      const previous = existing ? await this.devices.findDeviceById(variable.deviceId) : null;
      if (existing && (!previous || previous.homeId !== connection.homeId || previous.integrationSource !== 'modbus-tcp')) throw new ModbusError('FORBIDDEN', 'Invalid Modbus binding');
      const now = new Date().toISOString(), type = variable.writable ? 'switch' : variable.dataType === 'boolean' ? 'binary_sensor' : 'sensor';
      const device: Device = { id: variable.deviceId, homeId: connection.homeId, roomId: null,
        externalId: `modbus:${variable.deviceId}`, vendor: 'Modbus TCP', status: 'PENDING', integrationSource: 'modbus-tcp',
        invertState: false, lastKnownState: { state: 'unavailable', stale: true }, createdAt: now,
        ...previous, name: variable.name, type, semanticType: variable.writable ? 'switch' : 'sensor',
        updatedAt: now, entityVersion: (previous?.entityVersion ?? 0) + 1 };
      this.repository.saveVariable(variable, device);
      this.schedule.delete(connectionId);
      // Rebinding invalidates any reading taken from the previous address/unit.
      if (existing) await this.publishState(variable.deviceId, { state: 'unavailable', stale: true });
      return variable;
    });
  }
  supports(device: Device): boolean { return device.integrationSource === 'modbus-tcp'; }
  async deleteConnection(userId: string, id: string): Promise<void> {
    await this.authorize(userId, this.requireConnection(id).homeId);
    await this.serialize(id, async () => {
      this.requireConnection(id);
      this.repository.deleteConnection(id);
      this.schedule.delete(id);
    });
  }
  async deleteVariable(userId: string, connectionId: string, deviceId: string): Promise<void> {
    const connection = this.requireConnection(connectionId);
    await this.authorize(userId, connection.homeId);
    await this.serialize(connectionId, async () => {
      this.requireConnection(connectionId);
      const variable = this.repository.variable(deviceId);
      if (!variable || variable.connectionId !== connectionId) throw new ModbusError('NOT_FOUND', 'Modbus variable not found');
      const device = await this.devices.findDeviceById(deviceId);
      if (!device || device.homeId !== connection.homeId || !this.supports(device)) throw new ModbusError('FORBIDDEN', 'Invalid Modbus binding');
      this.repository.deleteVariable(deviceId);
      this.schedule.delete(connectionId);
    });
  }
  private state(variable: ModbusVariable, value: number | boolean): Record<string, unknown> {
    return { state: typeof value === 'boolean' ? value ? 'on' : 'off' : String(value), value,
      unit_of_measurement: variable.unit, available: true, stale: false };
  }
  async executeCommand(device: Device, command: DeviceDriverCommand): Promise<DeviceDriverResult> {
    try {
      const variable = this.repository.variable(device.id);
      if (!variable) throw new ModbusError('NOT_FOUND', 'Modbus binding not found');
      return await this.serialize(variable.connectionId, async () => {
        const current = this.repository.variable(device.id), connection = this.requireConnection(variable.connectionId);
        if (!this.supports(device) || connection.homeId !== device.homeId) throw new ModbusError('FORBIDDEN', 'Invalid Modbus binding');
        if (!current?.writable || current.area !== 'coil') throw new ModbusError('READ_ONLY', 'Modbus variable is read-only');
        try { validateProfileMapping(current, modbusWordCount(current.dataType), connection.moduleCapacities); } catch { throw new ModbusError('READ_ONLY', 'Protected profile address'); }
        if (!connection.enabled) throw new ModbusError('DISABLED', 'Modbus connection is disabled');
        if (!['turn_on', 'turn_off', 'toggle'].includes(command.name) || Object.keys(command.params ?? {}).length) throw new ModbusError('READ_ONLY', 'Unsupported Modbus command');
        const value = command.name === 'toggle' ? !(await this.transport.read(connection, current)) : command.name === 'turn_on';
        await this.transport.writeCoil(connection, current.address, value);
        // Echo acknowledges a write, not the actual physical state. Polling confirms it.
        const actual = await this.transport.read(connection, current);
        return { success: true, newState: this.state(current, actual) };
      });
    } catch (error: unknown) {
      if (!(error instanceof ModbusError) || ['CONNECTION', 'TIMEOUT', 'PROTOCOL'].includes(error.code)) {
        try { const variable = this.repository.variable(device.id); if (variable && this.requireConnection(variable.connectionId).homeId === device.homeId) await this.markUnavailable(variable.connectionId); } catch { /* Binding may have disappeared. */ }
      }
      return { success: false, error: error instanceof ModbusError ? error.code : 'CONNECTION' };
    }
  }
  private async markUnavailable(connectionId: string): Promise<void> {
    for (const variable of this.repository.variables(connectionId)) {
      const device = await this.devices.findDeviceById(variable.deviceId);
      if (device && device.homeId === this.requireConnection(connectionId).homeId && this.supports(device)) {
        await this.publishState(device.id, { ...device.lastKnownState, state: 'unavailable', available: false, stale: true });
      }
    }
  }
  async pollOnce(now = Date.now(), shouldContinue: () => boolean = () => true): Promise<void> {
    for (const connection of this.repository.connections()) {
      if (!shouldContinue()) return;
      if (!connection.enabled || (this.schedule.get(connection.id)?.due ?? 0) > now || this.queues.has(connection.id)) continue;
      await this.serialize(connection.id, async () => {
        const current = this.requireConnection(connection.id);
        if (!current.enabled) return;
        try {
          for (const variable of this.repository.variables(current.id)) {
            if (!shouldContinue()) return;
            const device = await this.devices.findDeviceById(variable.deviceId);
            if (!device || device.homeId !== current.homeId || !this.supports(device)) continue;
            const value = await this.transport.read(current, variable);
            await this.publishState(device.id, this.state(variable, value));
          }
          this.schedule.set(current.id, { due: now + current.pollIntervalMs, failures: 0 });
        } catch {
          const failures = Math.min(6, (this.schedule.get(current.id)?.failures ?? 0) + 1);
          this.schedule.set(current.id, { due: now + Math.min(60000, current.pollIntervalMs * 2 ** failures), failures });
          await this.markUnavailable(current.id);
        }
      });
    }
  }
  start(): void {
    if (this.running) return;
    this.running = true;
    const tick = async (): Promise<void> => {
      try { this.cycle = this.pollOnce(Date.now(), () => this.running); await this.cycle; } catch { /* Repository failures must not leave an unhandled timer rejection. */ }
      if (this.running) { this.timer = setTimeout(() => void tick(), 500); this.timer.unref(); }
    };
    void tick();
  }
  async stop(): Promise<void> {
    this.running = false; clearTimeout(this.timer);
    await this.cycle?.catch(() => undefined);
    await Promise.allSettled([...this.queues.values()]);
  }
}
