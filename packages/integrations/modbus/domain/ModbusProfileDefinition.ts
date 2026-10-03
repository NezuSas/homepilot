import type { ModbusArea } from './Modbus';

/** Runtime profile metadata; never serialized into connection/variable JSON. */
export interface ModbusAddressSegment {
  prefix: string; first: number; count: number; base: number; radix: 8 | 10;
  area: ModbusArea; writable: boolean; module?: string; channel?: 'inputs' | 'outputs';
  supportsPulse: boolean; supportsSetpoint: boolean;
}
export type ModbusModuleCapacities = Record<string, { inputs: number; outputs: number }>;
export interface ResolvedModbusAddress {
  area: ModbusArea; address: number; symbolicAddress: string; segment: ModbusAddressSegment;
  physicalCapacityKnown: boolean;
}
export interface ModbusAddressProfile {
  id: string; manufacturer: string; family: string; model: string; version: number;
  segments: readonly ModbusAddressSegment[];
  booleanBindingAreas: readonly ModbusArea[];
  maxRangeLength: number;
  validateCapacities(value: unknown): ModbusModuleCapacities | undefined;
  resolve(symbol: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress;
  format(segment: ModbusAddressSegment, index: number): string;
}
