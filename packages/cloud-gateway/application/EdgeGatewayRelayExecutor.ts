import type { DeviceCommandRequest, DeviceCommandV1 } from '../../devices/domain/commands';
import { sanitizeDashboardPayload, sanitizeDevicePayload } from './sanitizeCloudPayload';
import { isAllowedCloudDeviceCommand } from './CloudGatewayAuthorizationPolicy';
import type { EdgeRelayRequest } from './EdgeRelayProtocol';
export interface EdgeRelayExecutor { execute(request: EdgeRelayRequest): Promise<{ status: number; payload?: unknown }>; }

interface DirectoryLinkResolver { findByDirectoryAccountId(accountId: string): Promise<{ localUserId: string } | null>; }
interface LocalUserResolver { findById(userId: string): Promise<{ id: string; isActive: boolean } | null>; }
interface DashboardReader { getDashboardsForUser(userId: string, role: string): Promise<unknown[]>; }
interface DeviceReader { findAll(): Promise<ReadonlyArray<unknown>>; }
interface DeviceDispatcher { dispatch(deviceId: string, command: DeviceCommandRequest): Promise<void>; }

export interface EdgeGatewayRelayDependencies { directoryLinks: DirectoryLinkResolver; users: LocalUserResolver; dashboards: DashboardReader; devices: DeviceReader; dispatcher: DeviceDispatcher; }

export class EdgeGatewayRelayExecutor implements EdgeRelayExecutor {
  constructor(private readonly deps: EdgeGatewayRelayDependencies) {}
  async execute(request: EdgeRelayRequest): Promise<{ status: number; payload?: unknown }> {
    const user = await this.resolveActiveLocalUser(request.principal.accountId);
    if (!user) return { status: 403 };
    if (request.operation === 'dashboard.read') { const dashboards=await this.deps.dashboards.getDashboardsForUser(user.id, request.principal.role === 'owner' ? 'parent' : 'guest'); return { status: 200, payload: sanitizeDashboardPayload(dashboards) }; }
    if (request.operation === 'devices.read') { await this.deps.devices.findAll(); return { status: 200, payload: { dashboards: [] } }; }
    const command = parseCommand(request.input);
    if (!command) return { status: 400 };
    try { await this.deps.dispatcher.dispatch(command.deviceId, { name: command.command as DeviceCommandV1, params: command.params, metadata: { userId: user.id, correlationId: `cloud-gateway:${request.requestId}` } }); return { status: 204 }; }
    catch { return { status: 502 }; }
  }
  private async resolveActiveLocalUser(directoryAccountId: string): Promise<{ id: string } | null> { const link = await this.deps.directoryLinks.findByDirectoryAccountId(directoryAccountId); if (!link) return null; const user = await this.deps.users.findById(link.localUserId); return user?.isActive ? { id: user.id } : null; }
}

function parseCommand(input: unknown): { deviceId: string; command: string; params: Record<string, unknown> } | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.deviceId !== 'string' || !value.deviceId || !isAllowedCloudDeviceCommand(value.command)) return null;
  if (value.params !== undefined && (typeof value.params !== 'object' || value.params === null || Array.isArray(value.params))) return null;
  return { deviceId: value.deviceId, command: value.command, params: (value.params ?? {}) as Record<string, unknown> };
}
