import { addressProfile, resolveModbusAddress, validateProfileMapping, type ModbusModuleCapacities } from './ModbusAddressProfile';
import { ModbusError, modbusWordCount, type ModbusArea, type ModbusVariable } from './Modbus';

export const plcRoles = ['input', 'output', 'output_command', 'output_feedback', 'measurement', 'setpoint', 'diagnostic'] as const;
export type PlcRole = typeof plcRoles[number];
export interface PlcAddress { profileId: string; symbolicAddress: string; area: ModbusArea; address: number }
export interface PlcBinding {
  role: PlcRole;
  command?: PlcAddress;
  physical?: PlcAddress;
  feedback?: PlcAddress;
  logical?: PlcAddress;
  feedbackPolicy: 'none' | 'optional' | 'required';
  feedbackTimeoutMs: number;
  mode: 'sustained' | 'pulse';
  pulseDurationMs: number;
  min?: number;
  max?: number;
}
const invalid = (): never => { throw new ModbusError('INVALID_CONFIG', 'Invalid PLC binding'); };
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  return value as Record<string, unknown>;
}
function bounded(value: unknown, fallback: number, min: number, max: number): number {
  const result = value ?? fallback;
  if (typeof result !== 'number' || !Number.isInteger(result) || result < min || result > max) return invalid();
  return result;
}
/** Resolve again in the backend. No relationship is inferred from a PLC symbol. */
export function validatePlcBinding(value: unknown, variable: Pick<ModbusVariable, 'area' | 'address' | 'dataType' | 'profileId' | 'symbolicAddress' | 'writable'>, capacities?: ModbusModuleCapacities): PlcBinding | undefined {
  if (value === undefined || value === null) return undefined;
  const input = record(value);
  const role = plcRoles.find(role => role === input.role);
  if (!role) return invalid();
  const address = (value: unknown, writable = false): PlcAddress | undefined => {
    if (value === undefined || value === null) return undefined;
    const item = record(value);
    if (typeof item.profileId !== 'string' || typeof item.symbolicAddress !== 'string') return invalid();
    try {
      const resolved = resolveModbusAddress(item.profileId, item.symbolicAddress, capacities);
      if ((item.area !== undefined && item.area !== resolved.area) || (item.address !== undefined && item.address !== resolved.address) || (writable && !resolved.segment.writable)) return invalid();
      if (!addressProfile(item.profileId).booleanBindingAreas.includes(resolved.area)) return invalid();
      return { profileId: item.profileId, symbolicAddress: resolved.symbolicAddress, area: resolved.area, address: resolved.address };
    } catch { return invalid(); }
  };
  const writableRole = role === 'output' || role === 'output_command' || role === 'setpoint';
  if (variable.writable && !writableRole) return invalid();
  if (['input', 'output', 'output_command', 'output_feedback'].includes(role) && variable.dataType !== 'boolean') return invalid();
  if (['measurement', 'setpoint'].includes(role) && variable.dataType === 'boolean') return invalid();
  const command = address(input.command, true), physical = address(input.physical), feedback = address(input.feedback), logical = address(input.logical);
  const feedbackPolicy = input.feedbackPolicy ?? 'none', mode = input.mode ?? 'sustained';
  if (!['none', 'optional', 'required'].includes(String(feedbackPolicy)) || !['sustained', 'pulse'].includes(String(mode))) return invalid();
  if (feedbackPolicy !== 'none' && !feedback) return invalid();
  if (feedback && feedbackPolicy === 'none') return invalid();
  if (feedback && command && feedback.area === command.area && feedback.address === command.address) return invalid();
  if ((command || feedback || mode === 'pulse') && !['output', 'output_command'].includes(role)) return invalid();
  if (logical && role !== 'input') return invalid();
  if (writableRole && variable.writable && !variable.profileId) return invalid();
  if (role === 'output' && !physical) return invalid();
  if (variable.writable && ['output', 'output_command'].includes(role) && !command) return invalid();
  if (command && (command.profileId !== variable.profileId || command.area !== variable.area || command.address !== variable.address)) return invalid();
  if (role === 'setpoint') {
    if (variable.area !== 'holding_register' || !variable.profileId || !variable.symbolicAddress) return invalid();
    try { if (!resolveModbusAddress(variable.profileId, variable.symbolicAddress, capacities).segment.supportsSetpoint) return invalid(); } catch { return invalid(); }
    if (typeof input.min !== 'number' || typeof input.max !== 'number' || !Number.isFinite(input.min) || !Number.isFinite(input.max) || input.min >= input.max) return invalid();
  } else if (input.min !== undefined || input.max !== undefined) return invalid();
  if (mode === 'pulse') {
    if (!command) return invalid();
    // Operation permission is supplied by the resolved profile segment.
    try { if (!resolveModbusAddress(command.profileId, command.symbolicAddress, capacities).segment.supportsPulse) return invalid(); } catch { return invalid(); }
  }
  try { validateProfileMapping(variable, modbusWordCount(variable.dataType), capacities); } catch { return invalid(); }
  return { role, ...(command ? { command } : {}), ...(physical ? { physical } : {}), ...(feedback ? { feedback } : {}), ...(logical ? { logical } : {}), feedbackPolicy: feedbackPolicy as PlcBinding['feedbackPolicy'], feedbackTimeoutMs: bounded(input.feedbackTimeoutMs, 2000, 250, 10000), mode: mode as PlcBinding['mode'], pulseDurationMs: bounded(input.pulseDurationMs, 500, 100, 5000), ...(role === 'setpoint' ? { min: input.min as number, max: input.max as number } : {}) };
}

/** Explicit binding converted into the existing generic transport variable. */
export function plcReadVariable(variable: ModbusVariable, address: PlcAddress): ModbusVariable {
  return { ...variable, ...address, dataType: 'boolean', scale: 1, offset: 0, writable: false, plc: undefined };
}
