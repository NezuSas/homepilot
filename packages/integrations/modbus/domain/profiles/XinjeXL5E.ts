import type { ModbusAddressProfile, ModbusAddressSegment, ModbusModuleCapacities, ResolvedModbusAddress } from '../ModbusProfileDefinition';

// User-approved XL5E map. Reserved slots are not proof of physical channels.
const bits: ModbusAddressSegment[] = [
  ['M', 0, 20480, true], ['SM', 36864, 4096, false], ['T', 40960, 4096, false],
  ['C', 45056, 4096, false], ['HM', 49408, 6144, true], ['HT', 57600, 1024, false], ['HC', 58624, 1024, false],
].map(([prefix, base, count, writable]) => ({ prefix: String(prefix), base: Number(base), count: Number(count), writable: Boolean(writable), supportsPulse: Boolean(writable), supportsSetpoint: false, first: 0, radix: 10, area: 'coil' }));
const registers: ModbusAddressSegment[] = [
  ['D', 0, 20480], ['SD', 28672, 4096], ['TD', 32768, 4096], ['CD', 36864, 4096],
  ['HD', 41088, 6144], ['HTD', 48256, 1024], ['HCD', 49280, 1024],
].map(([prefix, base, count]) => ({ prefix: String(prefix), base: Number(base), count: Number(count), first: 0, radix: 10, area: 'holding_register', writable: false, supportsPulse: false, supportsSetpoint: false }));
const digital: ModbusAddressSegment[] = ['X', 'Y'].flatMap(prefix => Array.from({ length: 17 }, (_, module) => ({
  prefix, first: module === 0 ? 0 : 4096 + (module - 1) * 64, count: 64, radix: 8,
  base: (prefix === 'X' ? 20480 : 24576) + (module === 0 ? 0 : 256 + (module - 1) * 64),
  area: 'coil', writable: prefix === 'Y', supportsPulse: false, supportsSetpoint: false, module: module === 0 ? 'CPU' : String(module), channel: prefix === 'X' ? 'inputs' : 'outputs',
})));
function validateCapacities(value: unknown): ModbusModuleCapacities | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid module capacities');
  const result: ModbusModuleCapacities = {};
  for (const [key, capacity] of Object.entries(value)) {
    if (!/^(CPU|[1-9]|1[0-6])$/.test(key) || !capacity || typeof capacity !== 'object' || Array.isArray(capacity)) throw new Error('Invalid module');
    const fields = capacity as Record<string, unknown>;
    if (Object.keys(fields).some(field => field !== 'inputs' && field !== 'outputs')) throw new Error('Invalid capacity fields');
    const { inputs, outputs } = fields;
    if (typeof inputs !== 'number' || typeof outputs !== 'number' || !Number.isInteger(inputs) || !Number.isInteger(outputs) || inputs < 0 || outputs < 0 || inputs > 64 || outputs > 64) throw new Error('Invalid physical capacity');
    result[key] = { inputs, outputs };
  }
  return result;
}
function format(segment: ModbusAddressSegment, index: number): string {
  return `${segment.prefix}${index.toString(segment.radix).toUpperCase()}`;
}
function resolve(segments: readonly ModbusAddressSegment[], symbol: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress {
  const match = /^([A-Z]+)(0|[1-9][0-9]*)$/.exec(symbol.trim().toUpperCase());
  if (!match) throw new Error('Invalid PLC symbol');
  const [, prefix, digits] = match;
  const candidates = segments.filter(segment => segment.prefix === prefix);
  if (!candidates.length || (candidates[0].radix === 8 && /[89]/.test(digits))) throw new Error('Invalid PLC element');
  const index = Number.parseInt(digits, candidates[0].radix);
  const segment = candidates.find(item => index >= item.first && index < item.first + item.count);
  if (!segment || !Number.isSafeInteger(index)) throw new Error('PLC address outside profile');
  const capacity = segment.module && segment.channel ? capacities?.[segment.module]?.[segment.channel] : undefined;
  const relative = index - segment.first;
  if (capacity !== undefined && relative >= capacity) throw new Error('Address outside physical module capacity');
  return { area: segment.area, address: segment.base + relative, symbolicAddress: format(segment, index), segment, physicalCapacityKnown: !segment.module || capacity !== undefined };
}
const v1Segments = [...bits, ...digital, ...registers];
export const xinjeXL5E: ModbusAddressProfile = {
  id: 'xinje-xl5e-16t-v1', manufacturer: 'Xinje', family: 'XL5E', model: 'XL5E-16T', version: 1,
  segments: v1Segments, booleanBindingAreas: ['coil'], maxRangeLength: 64,
  validateCapacities, format, resolve: (symbol, capacities) => resolve(v1Segments, symbol, capacities),
};
// Historical IDs and permissions remain immutable.
const v2Segments = v1Segments.map(segment => ({ ...segment,
  writable: segment.writable || ['D', 'HD'].includes(segment.prefix),
  supportsSetpoint: ['D', 'HD'].includes(segment.prefix),
}));
export const xinjeXL5EV2: ModbusAddressProfile = { ...xinjeXL5E, id: 'xinje-xl5e-16t-v2', version: 2,
  segments: v2Segments, resolve: (symbol, capacities) => resolve(v2Segments, symbol, capacities),
};
export const xinjeXL5EProfiles: readonly ModbusAddressProfile[] = [xinjeXL5E, xinjeXL5EV2];
