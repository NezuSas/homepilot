import type { PlcRole } from './PlcBinding';
import type { ModbusAddressProfile, ModbusAddressSegment, ModbusModuleCapacities } from './ModbusProfileDefinition';

/** Runtime-only views. No parsing, transport, persistence or Ladder inference. */
export function profileFamilies(profile: ModbusAddressProfile) {
  const families = new Map<string, { familyId: string; kind: NonNullable<ModbusAddressSegment['semantics']>['kind']; segments: ModbusAddressSegment[] }>();
  for (const segment of profile.segments) {
    if (!segment.semantics) continue;
    const { familyId, kind } = segment.semantics;
    const family = families.get(familyId);
    if (family && family.kind !== kind) throw new Error('Inconsistent family classification');
    if (family) family.segments.push(segment);
    else families.set(familyId, { familyId, kind, segments: [segment] });
  }
  return [...families.values()];
}

export function profileRoleSegments(profile: ModbusAddressProfile, role: PlcRole) {
  return profile.segments.filter(segment => segment.semantics?.compatibleRoles.includes(role));
}

export function profileSegmentCapacity(profile: ModbusAddressProfile, segment: ModbusAddressSegment, capacities?: ModbusModuleCapacities) {
  if (!profile.segments.includes(segment)) throw new Error('Segment outside profile');
  const validated = profile.validateCapacities(capacities);
  const declared = segment.module && segment.channel ? validated?.[segment.module]?.[segment.channel] : undefined;
  return {
    reservedCount: segment.count,
    declaredCount: declared,
    selectableCount: declared ?? segment.count,
    capacityKnown: !segment.module || declared !== undefined,
    radix: segment.radix,
    writable: segment.writable,
    supportsPulse: segment.supportsPulse,
    supportsSetpoint: segment.supportsSetpoint,
  };
}

export function profileModules(profile: ModbusAddressProfile, capacities?: ModbusModuleCapacities) {
  const ids = [...new Set(profile.segments.flatMap(segment => segment.module ? [segment.module] : []))];
  return ids.map(id => ({ id, channels: profile.segments.filter(segment => segment.module === id).map(segment => ({
    familyId: segment.semantics?.familyId,
    channel: segment.channel,
    segment,
    ...profileSegmentCapacity(profile, segment, capacities),
  })) }));
}

/** Zero-based ordinal within the segment; format owns radix and module offsets. */
export function profileChannel(profile: ModbusAddressProfile, segment: ModbusAddressSegment, ordinal: number, capacities?: ModbusModuleCapacities) {
  const capacity = profileSegmentCapacity(profile, segment, capacities);
  if (!Number.isInteger(ordinal) || ordinal < 0 || ordinal >= capacity.selectableCount) throw new Error('Channel outside capacity');
  return profile.resolve(profile.format(segment, segment.first + ordinal), capacities);
}

/** Bounded page, rather than materializing thousands of reserved points. */
export function profileChannels(profile: ModbusAddressProfile, segment: ModbusAddressSegment, start: number, limit: number, capacities?: ModbusModuleCapacities) {
  const capacity = profileSegmentCapacity(profile, segment, capacities);
  if (!Number.isInteger(start) || start < 0 || start > capacity.selectableCount || !Number.isInteger(limit) || limit < 1 || limit > profile.maxRangeLength) throw new Error('Invalid channel page');
  return Array.from({ length: Math.min(limit, capacity.selectableCount - start) }, (_, index) => profileChannel(profile, segment, start + index, capacities));
}
