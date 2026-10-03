import { addressProfile, validateModuleCapacities, validateProfileMapping, type ModbusModuleCapacities } from './ModbusAddressProfile';
import { validatePlcBinding, type PlcBinding } from './PlcBinding';

export type ModbusArea = 'coil' | 'discrete_input' | 'holding_register' | 'input_register';
export type ModbusDataType = 'boolean' | 'uint16' | 'int16' | 'uint32' | 'int32' | 'float32';
export const modbusRegisterTypes = ['uint16', 'int16', 'uint32', 'int32', 'float32'] as const;
export function modbusWordCount(type: ModbusDataType): number { return type === 'uint32' || type === 'int32' || type === 'float32' ? 2 : 1; }
export interface ModbusProbeRow { address: number; raw: number | boolean | null; status: 'ok' | 'error'; elapsedMs: number | null; error?: string; exceptionCode?: number; symbolicAddress?: string; area?: ModbusArea; }
export interface ModbusProbeResult { rows: ModbusProbeRow[]; sampledAt: string; }
export interface ModbusDiagnostic { status: 'online' | 'unavailable' | 'variable_error' | 'pending' | 'unconfirmed' | 'error'; lastReadAt?: string; retryAt?: string; latencyMs?: number; raw?: Array<number | boolean>; value?: number | boolean; error?: string; commandedState?: boolean | number; confirmation?: string }
export const modbusVisualStyles = ['auto', 'gauge', 'thermometer', 'level', 'battery'] as const;
export type ModbusVisualStyle = typeof modbusVisualStyles[number];
/** One decoder for driver reads and installer previews. RAW words are unsigned and unscaled. */
export function convertModbusValue(words: readonly (number | boolean)[], config: Pick<ModbusVariable, 'dataType' | 'wordOrder' | 'scale' | 'offset'>): number | boolean {
  if (config.dataType === 'boolean') { if (typeof words[0] !== 'boolean') throw new ModbusError('PROTOCOL', 'Missing bit'); return words[0]; }
  const count = modbusWordCount(config.dataType);
  if (words.length < count || words.slice(0, count).some(word => typeof word !== 'number' || !Number.isInteger(word) || word < 0 || word > 65535)) throw new ModbusError('PROTOCOL', 'Missing register');
  const bytes = new DataView(new ArrayBuffer(4));
  const first = Number(words[0]), second = Number(words[1]);
  let value = first;
  if (count === 2) { bytes.setUint16(0, config.wordOrder === 'low_first' ? second : first); bytes.setUint16(2, config.wordOrder === 'low_first' ? first : second); value = config.dataType === 'float32' ? bytes.getFloat32(0) : config.dataType === 'int32' ? bytes.getInt32(0) : bytes.getUint32(0); }
  else if (config.dataType === 'int16' && first >= 32768) value = first - 65536;
  value = value * config.scale + config.offset;
  if (!Number.isFinite(value)) throw new ModbusError('CONVERSION', 'Non-finite reading');
  return value;
}
export interface ModbusConnection {
  id: string; homeId: string; name: string; host: string; port: number; unitId: number;
  timeoutMs: number; pollIntervalMs: number; enabled: boolean;
  profileId?: string; moduleCapacities?: ModbusModuleCapacities;
}
export interface ModbusVariable {
  deviceId: string; connectionId: string; name: string; area: ModbusArea; address: number;
  dataType: ModbusDataType; wordOrder: 'high_first' | 'low_first'; scale: number; offset: number;
  unit: string; writable: boolean;
  profileId?: string; symbolicAddress?: string;
  plc?: PlcBinding;
  visualStyle?: ModbusVisualStyle;
}
export class ModbusError extends Error {
  readonly exceptionCode?: number;
  readonly code: 'INVALID_CONFIG' | 'FORBIDDEN' | 'NOT_FOUND' | 'IN_USE' | 'READ_ONLY' | 'DISABLED' | 'LIMIT' | 'PROTOCOL' | 'TIMEOUT' | 'CONNECTION' | 'CANCELLED' | 'FEEDBACK_TIMEOUT' | 'RESET_FAILED' | 'CONVERSION';
  constructor(code: ModbusError['code'], message: string, exceptionCode?: number) { super(message); this.code = code; this.exceptionCode = exceptionCode; }
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
  let profileId: string | undefined, moduleCapacities: ModbusModuleCapacities | undefined;
  try { if (input.profileId != null && input.profileId !== '') { profileId = text(input.profileId, 80); addressProfile(profileId); } moduleCapacities = validateModuleCapacities(input.moduleCapacities); if (moduleCapacities && !profileId) return invalid(); } catch { return invalid(); }
  return { ...(profileId ? { profileId } : {}), ...(moduleCapacities ? { moduleCapacities } : {}), name: text(input.name, 80), host, port: integer(input.port, 502, 502, 502),
    unitId: integer(input.unitId, 1, 1, 247), timeoutMs: integer(input.timeoutMs, 2000, 250, 10000),
    pollIntervalMs: integer(input.pollIntervalMs, 5000, 1000, 60000), enabled: flag(input.enabled) };
}
export function validateVariable(input: Record<string, unknown>): Omit<ModbusVariable, 'deviceId' | 'connectionId'> {
  const area = input.area, dataType = input.dataType;
  if (area !== 'coil' && area !== 'discrete_input' && area !== 'holding_register' && area !== 'input_register') return invalid();
  if (dataType !== 'boolean' && dataType !== 'uint16' && dataType !== 'int16' && dataType !== 'uint32' && dataType !== 'int32' && dataType !== 'float32') return invalid();
  if ((area === 'coil' || area === 'discrete_input') !== (dataType === 'boolean')) return invalid();
  const writable = flag(input.writable);
  if (writable && area !== 'coil' && area !== 'holding_register') return invalid();
  const address = integer(input.address, -1, 0, 65536 - modbusWordCount(dataType)), wordOrder = input.wordOrder ?? 'high_first';
  if (wordOrder !== 'high_first' && wordOrder !== 'low_first') return invalid();
  const scale = input.scale ?? 1, offset = input.offset ?? 0;
  if (typeof scale !== 'number' || !Number.isFinite(scale) || scale === 0 || typeof offset !== 'number' || !Number.isFinite(offset)) return invalid();
  if (dataType === 'boolean' && (scale !== 1 || offset !== 0)) return invalid();
  const unit = input.unit ?? '';
  if (typeof unit !== 'string' || unit.length > 24) return invalid();
  const profileId = input.profileId == null || input.profileId === '' ? undefined : text(input.profileId, 80);
  const symbolicAddress = input.symbolicAddress == null || input.symbolicAddress === '' ? undefined : text(input.symbolicAddress, 32).toUpperCase();
  try { validateProfileMapping({ profileId, symbolicAddress, area, address, writable }, modbusWordCount(dataType)); } catch { return invalid(); }
  const plc = validatePlcBinding(input.plc, { area, address, dataType, profileId, symbolicAddress, writable });
  const visualStyle = input.visualStyle == null ? undefined : modbusVisualStyles.find(style => style === input.visualStyle);
  if (input.visualStyle != null && (!visualStyle || dataType === 'boolean')) return invalid();
  if (writable && area === 'holding_register' && (!plc || plc.role !== 'setpoint')) return invalid();
  return { ...(profileId ? { profileId, symbolicAddress } : {}), ...(plc ? { plc } : {}), ...(visualStyle ? { visualStyle } : {}), name: text(input.name, 80), area, address, dataType, wordOrder, scale, offset, unit: unit.trim(), writable };
}
