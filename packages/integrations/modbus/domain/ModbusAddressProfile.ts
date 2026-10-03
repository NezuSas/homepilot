import type { ModbusArea } from './Modbus';
import { xinjeXL5E } from './profiles/XinjeXL5E';

export interface ModbusAddressSegment {
  prefix: string; first: number; count: number; base: number; radix: 8 | 10;
  area: ModbusArea; writable: boolean; module?: string; channel?: 'inputs' | 'outputs';
}
export interface ModbusAddressProfile {
  id: string; manufacturer: string; family: string; model: string; version: number;
  segments: readonly ModbusAddressSegment[];
}
export type ModbusModuleCapacities = Record<string, { inputs: number; outputs: number }>;
export interface ResolvedModbusAddress {
  area: ModbusArea; address: number; symbolicAddress: string; segment: ModbusAddressSegment;
  physicalCapacityKnown: boolean;
}
// V1 remains immutable. V2 changes only the explicitly configurable D/HD write policy.
const xinjeXL5EV2: ModbusAddressProfile = { ...xinjeXL5E, id: 'xinje-xl5e-16t-v2', version: 2,
  segments: xinjeXL5E.segments.map(segment => ({ ...segment, writable: segment.writable || ['D', 'HD'].includes(segment.prefix) })) };
export const modbusAddressProfiles: readonly ModbusAddressProfile[] = [xinjeXL5E, xinjeXL5EV2];
export function addressProfile(id: string): ModbusAddressProfile {
  const profile = modbusAddressProfiles.find(item => item.id === id);
  if (!profile) throw new Error('Unknown address profile');
  return profile;
}
export function validateModuleCapacities(value: unknown): ModbusModuleCapacities | undefined {
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
export function resolveModbusAddress(profileId: string, symbol: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress {
  const profile = addressProfile(profileId);
  const match = /^([A-Z]+)(0|[1-9][0-9]*)$/.exec(symbol.trim().toUpperCase());
  if (!match) throw new Error('Invalid PLC symbol');
  const [, prefix, digits] = match;
  const segments = profile.segments.filter(segment => segment.prefix === prefix);
  if (!segments.length || (segments[0].radix === 8 && /[89]/.test(digits))) throw new Error('Invalid PLC element');
  const index = Number.parseInt(digits, segments[0].radix);
  const segment = segments.find(item => index >= item.first && index < item.first + item.count);
  if (!segment || !Number.isSafeInteger(index)) throw new Error('PLC address outside profile');
  const capacity = segment.module && segment.channel ? capacities?.[segment.module]?.[segment.channel] : undefined;
  const relative = index - segment.first;
  if (capacity !== undefined && relative >= capacity) throw new Error('Address outside physical module capacity');
  return { area: segment.area, address: segment.base + relative, symbolicAddress: `${prefix}${index.toString(segment.radix).toUpperCase()}`, segment, physicalCapacityKnown: !segment.module || capacity !== undefined };
}
export function resolveModbusRange(profileId: string, start: string, end: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress[] {
  const first = resolveModbusAddress(profileId, start, capacities), last = resolveModbusAddress(profileId, end, capacities);
  if (first.segment !== last.segment || last.address < first.address || last.address - first.address >= 64) throw new Error('Invalid symbolic range');
  return Array.from({ length: last.address - first.address + 1 }, (_, index) => resolveModbusAddress(profileId,
    `${first.segment.prefix}${(first.segment.first + first.address - first.segment.base + index).toString(first.segment.radix)}`, capacities));
}
export function validateProfileMapping(input: { profileId?: string; symbolicAddress?: string; area: ModbusArea; address: number; writable: boolean }, words: number, capacities?: ModbusModuleCapacities): void {
  if (!input.profileId && !input.symbolicAddress) return;
  if (!input.profileId || !input.symbolicAddress) throw new Error('Incomplete profile metadata');
  const resolved = resolveModbusAddress(input.profileId, input.symbolicAddress, capacities);
  if (resolved.area !== input.area || resolved.address !== input.address || (input.writable && !resolved.segment.writable)) throw new Error('Invalid profile mapping or write permission');
  if (words === 2) {
    const segment = resolved.segment;
    const next = resolveModbusAddress(input.profileId, `${segment.prefix}${(segment.first + resolved.address - segment.base + 1).toString(segment.radix)}`, capacities);
    if (next.segment !== segment) throw new Error('32-bit value crosses segment');
  }
}
