export type ModbusArea = 'coil' | 'discrete_input' | 'holding_register' | 'input_register';
export type ModbusDataType = 'boolean' | 'uint16' | 'int16' | 'float32';
export interface ModbusConnection {
  id: string; homeId: string; name: string; host: string; port: number; unitId: number;
  timeoutMs: number; pollIntervalMs: number; enabled: boolean;
}
export interface ModbusVariable {
  deviceId: string; connectionId: string; name: string; area: ModbusArea; address: number;
  dataType: ModbusDataType; wordOrder: 'high_first' | 'low_first'; scale: number; offset: number;
  unit: string; writable: boolean;
}
export class ModbusError extends Error {
  readonly code: 'INVALID_CONFIG' | 'FORBIDDEN' | 'NOT_FOUND' | 'READ_ONLY' | 'DISABLED' | 'LIMIT' | 'PROTOCOL' | 'TIMEOUT' | 'CONNECTION';
  constructor(code: ModbusError['code'], message: string) { super(message); this.code = code; }
}
const invalid = (): never => { throw new ModbusError('INVALID_CONFIG', 'Invalid Modbus configuration'); };
function integer(value: unknown, fallback: number, min: number, max: number): number {
  const n = value === undefined ? fallback : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) return invalid();
  return n;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) return invalid();
  return value.trim();
}
function flag(value: unknown): boolean {
  if (value !== undefined && typeof value !== 'boolean') return invalid();
  return value === true;
}
export function validateConnection(input: Record<string, unknown>): Omit<ModbusConnection, 'id' | 'homeId'> {
  const host = text(input.host, 15), parts = host.split('.');
  if (parts.length !== 4 || parts.some(p => !/^(0|[1-9]\d{0,2})$/.test(p) || Number(p) > 255)) return invalid();
  const [a, b, , d] = parts.map(Number);
  if (!(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) || d === 0 || d === 255) return invalid();
  return { name: text(input.name, 80), host, port: integer(input.port, 502, 502, 502),
    unitId: integer(input.unitId, 1, 1, 247), timeoutMs: integer(input.timeoutMs, 2000, 250, 10000),
    pollIntervalMs: integer(input.pollIntervalMs, 5000, 1000, 60000), enabled: flag(input.enabled) };
}
export function validateVariable(input: Record<string, unknown>): Omit<ModbusVariable, 'deviceId' | 'connectionId'> {
  const area = input.area, dataType = input.dataType;
  if (area !== 'coil' && area !== 'discrete_input' && area !== 'holding_register' && area !== 'input_register') return invalid();
  if (dataType !== 'boolean' && dataType !== 'uint16' && dataType !== 'int16' && dataType !== 'float32') return invalid();
  if ((area === 'coil' || area === 'discrete_input') !== (dataType === 'boolean')) return invalid();
  const writable = flag(input.writable);
  if (writable && area !== 'coil') return invalid();
  const address = integer(input.address, -1, 0, dataType === 'float32' ? 65534 : 65535), wordOrder = input.wordOrder ?? 'high_first';
  if (wordOrder !== 'high_first' && wordOrder !== 'low_first') return invalid();
  const scale = input.scale ?? 1, offset = input.offset ?? 0;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale === 0 || typeof offset !== 'number' || !Number.isFinite(offset)) return invalid();
  if (dataType === 'boolean' && (scale !== 1 || offset !== 0)) return invalid();
  const unit = input.unit ?? '';
  if (typeof unit !== 'string' || unit.length > 24) return invalid();
  return { name: text(input.name, 80), area, address, dataType, wordOrder, scale, offset, unit: unit.trim(), writable };
}
