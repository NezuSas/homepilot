import type { Device } from '../../../devices/domain/types';
import type { ModbusArea, ModbusConnection, ModbusVariable } from '../domain/Modbus';
export interface ModbusRepository {
  connections(homeId?: string): ModbusConnection[];
  connection(id: string): ModbusConnection | null;
  variables(connectionId: string): ModbusVariable[];
  variable(deviceId: string): ModbusVariable | null;
  saveConnection(connection: ModbusConnection): void;
  /** Atomic mapping + inventory persistence, preserving room and state. */
  saveVariable(variable: ModbusVariable, device: Device): void;
  deleteConnection(id: string): void;
  /** Atomic reference check, mapping and inventory deletion; rejects linked devices. */
  deleteVariable(deviceId: string): void;
}
export interface ModbusTransport {
  readRange(connection: ModbusConnection, area: ModbusArea, start: number, count: number, signal?: AbortSignal): Promise<Array<number | boolean>>;
  read(connection: ModbusConnection, variable: ModbusVariable): Promise<number | boolean>;
  writeCoil(connection: ModbusConnection, address: number, value: boolean): Promise<void>;
}
