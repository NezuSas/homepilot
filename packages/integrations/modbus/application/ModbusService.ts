import { randomUUID } from 'node:crypto';
import type { DeviceRepository } from '../../../devices/domain/repositories/DeviceRepository';
import type { HomeRepository } from '../../../topology/domain/repositories/HomeRepository';
import type { DeviceDriver, DeviceDriverCommand, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import type { Device } from '../../../devices/domain/types';
import { ModbusError, validateConnection, validateVariable, type ModbusConnection, type ModbusVariable, type ModbusProbeResult, type ModbusDiagnostic } from '../domain/Modbus';
import { resolveModbusRange, validateProfileMapping } from '../domain/ModbusAddressProfile';
import { modbusWordCount } from '../domain/Modbus';
import type { ModbusRepository, ModbusTransport } from './ModbusPorts';
import { plcReadVariable, validatePlcBinding } from '../domain/PlcBinding';
import { encodeModbusValue } from '../domain/ModbusEncoder';

export class ModbusService implements DeviceDriver {
  private readonly queues = new Map<string, Promise<unknown>>();
  private readonly pending = new Map<string, number>();
  private readonly schedule = new Map<string, { due: number; failures: number }>();
  private readonly dashboardDue = new Map<string, number>();
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;
  private cycle?: Promise<void>;
  private readonly probes = new Set<string>();
  private readonly diagnostics = new Map<string, ModbusDiagnostic>();
  private readonly commands = new Map<string, { commandedState: boolean | number; confirmation: string }>();
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
    return this.repository.connections(homeId).map(connection => ({ ...connection, diagnostic: this.diagnostics.has(connection.id) ? { ...this.diagnostics.get(connection.id), ...(this.schedule.get(connection.id)?.failures ? { retryAt: new Date(this.schedule.get(connection.id)!.due).toISOString() } : {}) } : undefined, variables: this.repository.variables(connection.id).map(variable => ({ ...variable, diagnostic: { ...this.diagnostics.get(variable.deviceId), ...this.commands.get(variable.deviceId) } })) }));
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
        try { for (const variable of this.repository.variables(existing.id)) { validateProfileMapping(variable, modbusWordCount(variable.dataType), connection.moduleCapacities); validatePlcBinding(variable.plc, variable, connection.moduleCapacities); } }
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
      try { validateProfileMapping(variable, modbusWordCount(variable.dataType), this.requireConnection(connectionId).moduleCapacities); validatePlcBinding(variable.plc, variable, this.requireConnection(connectionId).moduleCapacities); } catch { throw new ModbusError('INVALID_CONFIG', 'Invalid profile mapping'); }
      const previous = existing ? await this.devices.findDeviceById(variable.deviceId) : null;
      if (existing && (!previous || previous.homeId !== connection.homeId || previous.integrationSource !== 'modbus-tcp')) throw new ModbusError('FORBIDDEN', 'Invalid Modbus binding');
      const now = new Date().toISOString(), type = variable.dataType !== 'boolean' ? 'sensor' : variable.writable ? 'switch' : 'binary_sensor';
      const device: Device = { id: variable.deviceId, homeId: connection.homeId, roomId: null,
        externalId: `modbus:${variable.deviceId}`, vendor: 'Modbus TCP', status: 'PENDING', integrationSource: 'modbus-tcp',
        invertState: false, lastKnownState: { state: 'unavailable', stale: true }, createdAt: now,
        ...previous, name: variable.name, type, semanticType: type === 'switch' ? 'switch' : 'sensor',
        updatedAt: now, entityVersion: (previous?.entityVersion ?? 0) + 1 };
      this.repository.saveVariable(variable, device);
      this.commands.delete(variable.deviceId); this.diagnostics.delete(variable.deviceId);
      this.schedule.delete(connectionId);
      // Rebinding invalidates any reading taken from the previous address/unit.
      if (existing || variable.plc) await this.publishState(variable.deviceId, { state: 'unavailable', available: false, stale: true, plcRole: variable.plc?.role, plcMode: variable.plc?.mode, writable: variable.writable, plcVisualStyle: variable.visualStyle });
      return variable;
    });
  }
  supports(device: Device): boolean { return device.integrationSource === 'modbus-tcp'; }
  async deleteConnection(userId: string, id: string): Promise<void> {
    await this.authorize(userId, this.requireConnection(id).homeId);
    await this.serialize(id, async () => {
      this.requireConnection(id);
      this.repository.deleteConnection(id);
      this.diagnostics.delete(id);
      this.schedule.delete(id);
      this.dashboardDue.delete(id);
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
      this.commands.delete(deviceId); this.diagnostics.delete(deviceId);
      this.schedule.delete(connectionId);
    });
  }
  private state(variable: ModbusVariable, value: number | boolean): Record<string, unknown> {
    return { state: typeof value === 'boolean' ? value ? 'on' : 'off' : String(value), value,
      unit_of_measurement: variable.unit, available: true, stale: false, plcRole: variable.plc?.role, plcMode: variable.plc?.mode, writable: variable.writable, plcVisualStyle: variable.visualStyle };
  }
  private async readState(connection: ModbusConnection, variable: ModbusVariable): Promise<Record<string, unknown>> {
    try { validateProfileMapping(variable, modbusWordCount(variable.dataType), connection.moduleCapacities); validatePlcBinding(variable.plc, variable, connection.moduleCapacities); } catch { throw new ModbusError('INVALID_CONFIG', 'Invalid PLC mapping'); }
    const started = Date.now(), plc = variable.plc;
    const primary = plc?.role === 'input' && plc.logical ? plcReadVariable(variable, plc.logical) : variable;
    const sample = this.transport.readSample ? await this.transport.readSample(connection, primary) : { value: await this.transport.read(connection, primary), raw: undefined };
    const value = sample.value;
    const physicalState = plc?.physical ? await this.transport.read(connection, plcReadVariable(variable, plc.physical)) : undefined;
    const feedbackState = plc?.feedback ? await this.transport.read(connection, plcReadVariable(variable, plc.feedback)) : undefined;
    const actual = feedbackState ?? value;
    const command = this.commands.get(variable.deviceId);
    const confirmation = command ? (command.confirmation === 'reset_failed' ? 'reset_failed' : actual === command.commandedState ? 'confirmed' : command.confirmation === 'pending' ? 'pending' : 'unconfirmed') : undefined;
    if (command && confirmation) this.commands.set(variable.deviceId, { ...command, confirmation });
    this.diagnostics.set(variable.deviceId, { status: 'online', lastReadAt: new Date().toISOString(), latencyMs: Date.now() - started, raw: sample.raw, value: actual });
    return { ...this.state(variable, actual), ...(plc ? { actualState: actual, ...(['output', 'output_command'].includes(plc.role) ? { commandState: value } : ['measurement', 'setpoint'].includes(plc.role) ? { measurementState: value } : plc.role === 'input' && plc.logical ? { logicalState: value } : {}), physicalState, feedbackState, ...(command ? { commandedState: command.commandedState, confirmation } : {}) } : {}) };
  }
  async executeCommand(device: Device, command: DeviceDriverCommand): Promise<DeviceDriverResult> {
    try {
      const variable = this.repository.variable(device.id);
      if (!variable) throw new ModbusError('NOT_FOUND', 'Modbus binding not found');
      return await this.serialize(variable.connectionId, async () => {
        const current = this.repository.variable(device.id), connection = this.requireConnection(variable.connectionId);
        if (!this.supports(device) || connection.homeId !== device.homeId) throw new ModbusError('FORBIDDEN', 'Invalid Modbus binding');
        if (!current?.writable) throw new ModbusError('READ_ONLY', 'Modbus variable is read-only');
        try { validateProfileMapping(current, modbusWordCount(current.dataType), connection.moduleCapacities); validatePlcBinding(current.plc, current, connection.moduleCapacities); } catch { throw new ModbusError('READ_ONLY', 'Protected profile address'); }
        if (!connection.enabled) throw new ModbusError('DISABLED', 'Modbus connection is disabled');
        const plc = current.plc;
        if (command.name === 'set_value') {
          const value = command.params?.value;
          if (plc?.role !== 'setpoint' || Object.keys(command.params ?? {}).length !== 1 || typeof value !== 'number' || value < (plc.min ?? Infinity) || value > (plc.max ?? -Infinity)) throw new ModbusError('READ_ONLY', 'Invalid setpoint command');
          const words = encodeModbusValue(value, current);
          this.commands.set(current.deviceId, { commandedState: value, confirmation: 'pending' });
          const previous = await this.devices.findDeviceById(current.deviceId);
          await this.publishState(current.deviceId, { ...previous?.lastKnownState, commandedState: value, confirmation: 'pending' });
          await this.transport.writeHoldingRegisters(connection, current.address, words);
          return { success: true, newState: await this.readState(connection, current) };
        }
        const pulse = command.name === 'pulse' || command.name === 'press';
        if (current.area !== 'coil' || Object.keys(command.params ?? {}).length || (pulse ? plc?.mode !== 'pulse' : !['turn_on', 'turn_off', 'toggle'].includes(command.name) || plc?.mode === 'pulse')) throw new ModbusError('READ_ONLY', 'Unsupported Modbus command');
        const value = pulse ? true : command.name === 'toggle' ? !(await this.transport.read(connection, plc?.feedback ? plcReadVariable(current, plc.feedback) : current)) : command.name === 'turn_on';
        this.commands.set(current.deviceId, { commandedState: value, confirmation: 'pending' });
        const previous = await this.devices.findDeviceById(current.deviceId);
        await this.publishState(current.deviceId, { ...previous?.lastKnownState, commandedState: value, confirmation: 'pending' });
        if (pulse) {
          // OFF is a cleanup attempt, NOT a retry. A PLC watchdog is still required.
          let onError: unknown;
          try { await this.transport.writeCoil(connection, current.address, true); await new Promise(resolve => setTimeout(resolve, plc!.pulseDurationMs)); } catch (error: unknown) { onError = error; }
          try { await this.transport.writeCoil(connection, current.address, false); }
          catch { this.commands.set(current.deviceId, { commandedState: value, confirmation: 'reset_failed' }); throw new ModbusError('RESET_FAILED', 'PLC pulse reset failed'); }
          if (onError) throw onError;
        } else await this.transport.writeCoil(connection, current.address, value);
        if (plc?.feedbackPolicy === 'required') {
          const deadline = Date.now() + plc.feedbackTimeoutMs;
          do {
            const feedback = await this.transport.read({ ...connection, timeoutMs: Math.max(1, Math.min(connection.timeoutMs, deadline - Date.now())) }, plcReadVariable(current, plc.feedback!));
            const state = { ...this.state(current, feedback), actualState: feedback, feedbackState: feedback, commandedState: value, confirmation: feedback === value ? 'confirmed' : 'pending' };
            await this.publishState(current.deviceId, state);
            if (state.actualState === value) { this.commands.set(current.deviceId, { commandedState: value, confirmation: 'confirmed' }); return { success: true, newState: state }; }
            const remaining = deadline - Date.now();
            if (remaining <= 0) break;
            await new Promise(resolve => setTimeout(resolve, Math.min(100, remaining)));
          } while (Date.now() < deadline);
          this.commands.set(current.deviceId, { commandedState: value, confirmation: 'unconfirmed' });
          const actual = await this.devices.findDeviceById(current.deviceId);
          await this.publishState(current.deviceId, { ...actual?.lastKnownState, commandedState: value, confirmation: 'unconfirmed', error: 'FEEDBACK_TIMEOUT' });
          throw new ModbusError('FEEDBACK_TIMEOUT', 'Independent feedback did not confirm');
        }
        if (plc?.feedbackPolicy === 'optional') this.commands.set(current.deviceId, { commandedState: value, confirmation: 'unconfirmed' });
        const state = await this.readState(connection, current);
        if (pulse && !plc?.feedback) { this.commands.delete(current.deviceId); delete state.commandedState; state.confirmation = 'pulse_completed'; }
        return { success: true, newState: state };
      });
    } catch (error: unknown) {
      this.diagnostics.set(device.id, { status: 'error', error: error instanceof ModbusError ? error.code : 'CONNECTION' });
      const pendingCommand = this.commands.get(device.id);
      if (pendingCommand?.confirmation === 'pending') {
        this.commands.set(device.id, { ...pendingCommand, confirmation: 'unconfirmed' });
        const previous = await this.devices.findDeviceById(device.id);
        await this.publishState(device.id, { ...previous?.lastKnownState, commandedState: pendingCommand.commandedState, confirmation: 'unconfirmed', error: error instanceof ModbusError ? error.code : 'CONNECTION' });
      }
      if (error instanceof ModbusError && error.code === 'RESET_FAILED') {
        const previous = await this.devices.findDeviceById(device.id);
        await this.publishState(device.id, { ...previous?.lastKnownState, confirmation: 'reset_failed', error: error.code });
      }
      if (!(error instanceof ModbusError) || ['CONNECTION', 'TIMEOUT'].includes(error.code) || (error.code === 'PROTOCOL' && error.exceptionCode === undefined)) {
        try { const variable = this.repository.variable(device.id); if (variable && this.requireConnection(variable.connectionId).homeId === device.homeId) await this.markUnavailable(variable.connectionId); } catch { /* Binding may have disappeared. */ }
      }
      return { success: false, error: error instanceof ModbusError ? error.code : 'CONNECTION' };
    }
  }
  private async markUnavailable(connectionId: string, error = 'connection_error'): Promise<void> {
    this.diagnostics.set(connectionId, { ...this.diagnostics.get(connectionId), status: 'unavailable', error });
    for (const variable of this.repository.variables(connectionId)) {
      this.diagnostics.set(variable.deviceId, { ...this.diagnostics.get(variable.deviceId), status: 'unavailable', error: 'connection_error' });
      const device = await this.devices.findDeviceById(variable.deviceId);
      if (device && device.homeId === this.requireConnection(connectionId).homeId && this.supports(device)) {
        await this.publishState(device.id, { ...device.lastKnownState, state: 'unavailable', available: false, stale: true });
      }
    }
  }
  async pollOnce(now = Date.now(), shouldContinue: () => boolean = () => true): Promise<void> {
    let dashboardIds: ReadonlySet<string> = new Set();
    try { dashboardIds = this.repository.dashboardDeviceIds?.() ?? dashboardIds; } catch { /* Missing historical dashboard table must not stop normal polling. */ }
    for (const connection of this.repository.connections()) {
      if (!shouldContinue()) return;
      const scheduled = this.schedule.get(connection.id);
      const fullCycle = (scheduled?.due ?? 0) <= now;
      if (!connection.enabled || (!fullCycle && scheduled?.failures) || this.queues.has(connection.id)) continue;
      const priorityDue = (this.dashboardDue.get(connection.id) ?? 0) <= now;
      const variables = this.repository.variables(connection.id)
        .filter(variable => fullCycle || (priorityDue && dashboardIds.has(variable.deviceId)))
        .sort((a, b) => Number(dashboardIds.has(b.deviceId)) - Number(dashboardIds.has(a.deviceId)));
      if (!variables.length) continue;
      await this.serialize(connection.id, async () => {
        const current = this.requireConnection(connection.id);
        if (!current.enabled) return;
        const started = Date.now();
        try {
          for (const variable of variables) {
            if (!shouldContinue()) return;
            const device = await this.devices.findDeviceById(variable.deviceId);
            if (!device || device.homeId !== current.homeId || !this.supports(device)) continue;
            try {
              await this.publishState(device.id, await this.readState(current, variable));
            } catch (error: unknown) {
              if (!(error instanceof ModbusError) || ['CONNECTION', 'TIMEOUT'].includes(error.code) || (error.code === 'PROTOCOL' && error.exceptionCode === undefined)) throw error;
              this.diagnostics.set(variable.deviceId, { ...this.diagnostics.get(variable.deviceId), status: 'variable_error', error: error.code });
              await this.publishState(device.id, { ...device.lastKnownState, state: 'unavailable', available: false, stale: true, error: error.code });
            }
          }
          if (fullCycle) this.schedule.set(current.id, { due: now + current.pollIntervalMs, failures: 0 });
          this.dashboardDue.set(current.id, now + 1000);
          this.diagnostics.set(current.id, { status: 'online', lastReadAt: new Date().toISOString(), latencyMs: Date.now() - started });
        } catch (error: unknown) {
          const failures = Math.min(6, (this.schedule.get(current.id)?.failures ?? 0) + 1);
          this.schedule.set(current.id, { due: now + Math.min(60000, current.pollIntervalMs * 2 ** failures), failures });
          await this.markUnavailable(current.id, error instanceof ModbusError ? error.code : 'CONNECTION');
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
