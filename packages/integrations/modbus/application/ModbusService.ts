import { randomUUID } from 'node:crypto';
import type { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { DeviceDriver, DeviceDriverCommand, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import type { Device } from '../../../devices/domain/types';
import { ModbusError, validateConnection, validateVariable, type ModbusConnection, type ModbusVariable } from '../domain/Modbus';
import type { ModbusRepository, ModbusTransport } from './ModbusPorts';

export class ModbusService implements DeviceDriver {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly pending = new Map<string, number>();
  private readonly schedule = new Map<string, { due: number; failures: number }>();
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private cycle?: Promise<void>;
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
  async saveConnection(userId: string, homeId: string, input: Record<string, unknown>, id?: string): Promise<ModbusConnection> {
    await this.authorize(userId, homeId);
    const existing = id ? this.requireConnection(id) : null;
    if (existing && existing.homeId !== homeId) throw new ModbusError('FORBIDDEN', 'Home is not accessible');
    const connection = { ...validateConnection({ ...existing, ...input }), id: existing?.id ?? randomUUID(), homeId };
    return this.serialize(connection.id, async () => {
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
      const existing = deviceId ? this.repository.variable(deviceId) : null;
      if (deviceId && (!existing || existing.connectionId !== connectionId)) throw new ModbusError('NOT_FOUND', 'Modbus variable not found');
      if (!existing && this.repository.variables(connectionId).length >= 128) throw new ModbusError('LIMIT', 'Too many Modbus variables');
      const variable: ModbusVariable = { ...validateVariable({ ...existing, ...input }), deviceId: deviceId ?? randomUUID(), connectionId };
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
