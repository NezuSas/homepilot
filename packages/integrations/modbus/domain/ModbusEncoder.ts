import { ModbusError, type ModbusVariable } from './Modbus';

/** Inverse of the shared decoder: BE bytes, configurable 32-bit word order. */
export function encodeModbusValue(value: unknown, variable: Pick<ModbusVariable, 'dataType' | 'scale' | 'offset' | 'wordOrder'>): number[] {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isFinite(variable.scale) || variable.scale === 0 || !Number.isFinite(variable.offset)) throw new ModbusError('INVALID_CONFIG', 'Invalid engineering value');
  const raw = (value - variable.offset) / variable.scale;
  if (!Number.isFinite(raw) || variable.dataType === 'boolean') throw new ModbusError('INVALID_CONFIG', 'Invalid register value');
  const limits = { uint16: [0, 65535], int16: [-32768, 32767], uint32: [0, 4294967295], int32: [-2147483648, 2147483647] };
  const bytes = new DataView(new ArrayBuffer(4));
  if (variable.dataType === 'float32') {
    bytes.setFloat32(0, raw);
    if (!Number.isFinite(bytes.getFloat32(0))) throw new ModbusError('INVALID_CONFIG', 'Float overflow');
  } else {
    const [min, max] = limits[variable.dataType];
    const integer = Math.round(raw);
    if (Math.abs(raw - integer) > Number.EPSILON * Math.max(1, Math.abs(raw)) * 8 || integer < min || integer > max) throw new ModbusError('INVALID_CONFIG', 'Register overflow or fractional integer');
    if (variable.dataType === 'uint16' || variable.dataType === 'int16') return [integer & 0xffff];
    if (variable.dataType === 'int32') bytes.setInt32(0, integer); else bytes.setUint32(0, integer);
  }
  const words = [bytes.getUint16(0), bytes.getUint16(2)];
  return variable.wordOrder === 'low_first' ? words.reverse() : words;
}
