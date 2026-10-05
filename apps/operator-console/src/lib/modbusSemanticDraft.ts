import type { ModbusVariable } from '../../../../packages/integrations/modbus/domain/Modbus';
import type { PlcAddress, PlcRole } from '../../../../packages/integrations/modbus/domain/PlcBinding';
import type { ModbusAddressProfile, ModbusModuleCapacities, ResolvedModbusAddress } from '../../../../packages/integrations/modbus/domain/ModbusProfileDefinition';

export type ModbusVariableDraft = Omit<ModbusVariable, 'deviceId' | 'connectionId'>;
export const plcPointAddress = (profile: ModbusAddressProfile, point: ResolvedModbusAddress): PlcAddress => ({
  profileId: profile.id, symbolicAddress: point.symbolicAddress, area: point.area, address: point.address,
});

/** Only called by an explicit selection. Rendering a historical draft never calls it. */
export function selectPrimaryPoint(draft: ModbusVariableDraft, point: PlcAddress): ModbusVariableDraft {
  const bit = point.area === 'coil' || point.area === 'discrete_input';
  return { ...draft, profileId: point.profileId, symbolicAddress: point.symbolicAddress, area: point.area, address: point.address,
    dataType: bit ? 'boolean' : draft.dataType === 'boolean' ? 'uint16' : draft.dataType,
    scale: bit ? 1 : draft.scale, offset: bit ? 0 : draft.offset, writable: false,
    ...(bit ? { visualStyle: undefined } : {}),
    ...(draft.plc && ['output', 'output_command'].includes(draft.plc.role) ? { plc: { ...draft.plc, command: point } } : {}),
  };
}

export function selectPhysicalPoint(draft: ModbusVariableDraft, point: PlcAddress): ModbusVariableDraft {
  if (!draft.plc) return draft;
  const primary = draft.plc.role === 'input' ? selectPrimaryPoint(draft, point) : draft;
  return { ...primary, dataType: 'boolean', scale: 1, offset: 0, writable: false, plc: { ...draft.plc, physical: point } };
}

export function hasPlcRelations(draft: ModbusVariableDraft): boolean {
  const plc = draft.plc;
  return !!(plc && (plc.command || plc.physical || plc.logical || plc.feedback || plc.relatedPhysicalOutputs?.length));
}

/** Explicit, confirmed role change; does not fabricate any point or Ladder link. */
export function changeDraftRole(draft: ModbusVariableDraft, role?: PlcRole): ModbusVariableDraft {
  return { ...draft, writable: false, plc: role ? {
    role, feedbackPolicy: 'none', feedbackTimeoutMs: 2000, mode: 'sustained', pulseDurationMs: 500,
    ...(role === 'setpoint' ? { min: 0, max: 100 } : {}),
  } : undefined };
}

/** Preserve technical area/PDU until a new point is explicitly selected. */
export function changeDraftProfile(draft: ModbusVariableDraft, profileId: string): ModbusVariableDraft {
  const next = changeDraftRole(draft, draft.plc?.role);
  return { ...next, profileId: profileId || undefined, symbolicAddress: undefined };
}

export function displayedInputSource(draft: ModbusVariableDraft): string {
  return draft.plc?.logical?.symbolicAddress ?? draft.symbolicAddress ?? '';
}

/** New guided configurations only; never used to normalize historical bindings. */
export function validateSemanticDraft(draft: ModbusVariableDraft, profile: ModbusAddressProfile, capacities?: ModbusModuleCapacities): void {
  const plc = draft.plc;
  if (!plc) return;
  const resolve = (point: PlcAddress | undefined) => {
    if (!point || point.profileId !== profile.id) throw new Error('Missing point');
    const resolved = profile.resolve(point.symbolicAddress, capacities);
    if (resolved.area !== point.area || resolved.address !== point.address) throw new Error('Invalid mapping');
    return resolved.segment;
  };
  const primary = resolve({ profileId: draft.profileId ?? '', symbolicAddress: draft.symbolicAddress ?? '', area: draft.area, address: draft.address });
  const primaryRole = plc.role === 'output' ? 'output_command' : plc.role;
  if (!primary.semantics?.compatibleRoles.includes(primaryRole)) throw new Error('Incompatible usage');
  if (plc.role === 'input' && resolve(plc.physical).semantics?.kind !== 'physical_input') throw new Error('Physical input required');
  if (plc.role === 'output' && resolve(plc.physical).semantics?.kind !== 'physical_output') throw new Error('Physical output required');
  if (plc.logical && resolve(plc.logical).semantics?.kind !== 'internal_memory') throw new Error('Logical source required');
  if (plc.feedback && !resolve(plc.feedback).semantics?.compatibleRoles.includes('output_feedback')) throw new Error('Incompatible return point');
  if (plc.role === 'setpoint' && !primary.supportsSetpoint) throw new Error('Setpoint unsupported');
}
