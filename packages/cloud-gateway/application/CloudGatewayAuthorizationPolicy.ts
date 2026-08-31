import type { EdgeRelayOperation } from './EdgeRelayProtocol';

export type CloudMembershipRole = 'owner' | 'member';
export type LocalGatewayPrincipal = 'parent' | 'read-only';

/**
 * Deliberately narrower than local roles: Cloud cannot administer an Edge.
 * A member can view sanitised state; only the Cloud home owner can issue a
 * whitelisted physical command through the scoped local gateway principal.
 */
export function localGatewayPrincipal(role: CloudMembershipRole): LocalGatewayPrincipal {
  return role === 'owner' ? 'parent' : 'read-only';
}

export function isGatewayOperationAllowed(role: CloudMembershipRole, operation: EdgeRelayOperation): boolean {
  if (operation === 'dashboard.read' || operation === 'devices.read') return true;
  return role === 'owner' && operation === 'device.command';
}

export const allowedCloudDeviceCommands = new Set([
  'turn_on', 'turn_off', 'toggle', 'open', 'close', 'stop', 'set_position',
  'play', 'pause', 'next_track', 'previous_track', 'volume_set',
]);

export function isAllowedCloudDeviceCommand(value: unknown): value is string {
  return typeof value === 'string' && allowedCloudDeviceCommands.has(value);
}
