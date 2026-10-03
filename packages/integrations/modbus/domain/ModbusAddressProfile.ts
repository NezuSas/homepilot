import type { ModbusArea } from './Modbus';
import { xinjeXL5EProfiles } from './profiles/XinjeXL5E';
import type { ModbusAddressProfile, ModbusModuleCapacities, ResolvedModbusAddress } from './ModbusProfileDefinition';

export type { ModbusAddressSegment, ModbusAddressProfile, ModbusModuleCapacities, ResolvedModbusAddress } from './ModbusProfileDefinition';
/** Static registration only; manufacturer decisions belong to the profile. */
export const modbusAddressProfiles: readonly ModbusAddressProfile[] = [...xinjeXL5EProfiles];
export function addressProfile(id: string): ModbusAddressProfile {
  const profile = modbusAddressProfiles.find(item => item.id === id);
  if (!profile) throw new Error('Unknown address profile');
  return profile;
}
export function validateModuleCapacities(value: unknown, profileId?: string): ModbusModuleCapacities | undefined {
  if (value === undefined || value === null) return undefined;
  if (!profileId) throw new Error('Module capacities require a profile');
  return addressProfile(profileId).validateCapacities(value);
}
export function resolveModbusAddress(profileId: string, symbol: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress {
  return addressProfile(profileId).resolve(symbol, capacities);
}
export function resolveModbusRange(profileId: string, start: string, end: string, capacities?: ModbusModuleCapacities): ResolvedModbusAddress[] {
  const profile = addressProfile(profileId);
  const first = resolveModbusAddress(profileId, start, capacities), last = resolveModbusAddress(profileId, end, capacities);
  if (first.segment !== last.segment || last.address < first.address || last.address - first.address >= profile.maxRangeLength) throw new Error('Invalid symbolic range');
  return Array.from({ length: last.address - first.address + 1 }, (_, index) => resolveModbusAddress(profileId,
    profile.format(first.segment, first.segment.first + first.address - first.segment.base + index), capacities));
}
export function validateProfileMapping(input: { profileId?: string; symbolicAddress?: string; area: ModbusArea; address: number; writable: boolean }, words: number, capacities?: ModbusModuleCapacities): void {
  if (!input.profileId && !input.symbolicAddress) return;
  if (!input.profileId || !input.symbolicAddress) throw new Error('Incomplete profile metadata');
  const resolved = resolveModbusAddress(input.profileId, input.symbolicAddress, capacities);
  if (resolved.area !== input.area || resolved.address !== input.address || (input.writable && !resolved.segment.writable)) throw new Error('Invalid profile mapping or write permission');
  if (words === 2) {
    const segment = resolved.segment;
    const next = resolveModbusAddress(input.profileId, addressProfile(input.profileId).format(segment, segment.first + resolved.address - segment.base + 1), capacities);
    if (next.segment !== segment) throw new Error('32-bit value crosses segment');
  }
}
