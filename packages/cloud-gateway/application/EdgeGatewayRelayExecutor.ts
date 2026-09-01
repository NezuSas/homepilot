import type { DeviceCommandRequest, DeviceCommandV1 } from '../../devices/domain/commands';
import { sanitizeDashboardPayload, sanitizeDevicePayload } from './sanitizeCloudPayload';
import { isAllowedCloudDeviceCommand } from './CloudGatewayAuthorizationPolicy';
import type { EdgeRelayRequest } from './EdgeRelayProtocol';

export interface EdgeRelayExecutor { execute(request: EdgeRelayRequest): Promise<{ status: number; payload?: unknown }>; }

interface LocalHomeResolver { findAll(): Promise<ReadonlyArray<{ id: string }>>; }
interface DeviceReader {
  findAllByHomeId(homeId: string): Promise<ReadonlyArray<unknown>>;
  findDeviceById(deviceId: string): Promise<unknown | null>;
}
interface DeviceDispatcher { dispatch(deviceId: string, command: DeviceCommandRequest): Promise<void>; }
interface DirectoryAccountLinks { findByDirectoryAccountId(accountId: string): Promise<{ localUserId: string } | null>; }
interface LocalUsers { findById(userId: string): Promise<{ role: string; isActive: boolean } | null>; }
interface DashboardReader { getDashboardsForUser(userId: string, role: string): Promise<unknown[]>; }

export interface EdgeGatewayRelayDependencies { homes: LocalHomeResolver; devices: DeviceReader; dispatcher: DeviceDispatcher; directoryLinks?: DirectoryAccountLinks; users?: LocalUsers; dashboards?: DashboardReader; }

/** Cloud membership is authorized by Directory and never maps to an Edge user's session. */
export class EdgeGatewayRelayExecutor implements EdgeRelayExecutor {
  constructor(private readonly deps: EdgeGatewayRelayDependencies) {}

  async execute(request: EdgeRelayRequest): Promise<{ status: number; payload?: unknown }> {
    const localHomeId = await this.resolveSingleLocalHomeId();
    if (!localHomeId) return { status: 503 };
    if (request.operation === 'dashboard.read') return { status: 200, payload: sanitizeDashboardPayload(await this.readDashboardsForLinkedUser(request.principal.accountId)) };
    if (request.operation === 'devices.read') return { status: 200, payload: sanitizeDevicePayload(await this.deps.devices.findAllByHomeId(localHomeId)) };
    if (request.principal.role !== 'owner') return { status: 403 };

    const command = parseCommand(request.input);
    if (!command) return { status: 400 };
    const device = await this.deps.devices.findDeviceById(command.deviceId);
    if (!belongsToHome(device, localHomeId)) return { status: 404 };
    try {
      await this.deps.dispatcher.dispatch(command.deviceId, { name: command.command as DeviceCommandV1, params: command.params, metadata: { userId: 'cloud-gateway', correlationId: `cloud-gateway:${request.requestId}` } });
      return { status: 204 };
    } catch { return { status: 502 }; }
  }

  private async readDashboardsForLinkedUser(directoryAccountId: string): Promise<unknown[]> {
    if (!this.deps.directoryLinks || !this.deps.users || !this.deps.dashboards) return [];
    const link = await this.deps.directoryLinks.findByDirectoryAccountId(directoryAccountId);
    if (!link) return [];
    const user = await this.deps.users.findById(link.localUserId);
    if (!user?.isActive) return [];
    return this.deps.dashboards.getDashboardsForUser(link.localUserId, user.role);
  }
  private async resolveSingleLocalHomeId(): Promise<string | null> {
    const homes = await this.deps.homes.findAll();
    return homes.length === 1 ? homes[0].id : null;
  }
}

function belongsToHome(value: unknown, homeId: string): boolean {
  return Boolean(value && typeof value === 'object' && (value as { homeId?: unknown }).homeId === homeId);
}

function parseCommand(input: unknown): { deviceId: string; command: string; params: Record<string, unknown> } | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.deviceId !== 'string' || !value.deviceId || !isAllowedCloudDeviceCommand(value.command)) return null;
  if (value.params !== undefined && (typeof value.params !== 'object' || value.params === null || Array.isArray(value.params))) return null;
  return { deviceId: value.deviceId, command: value.command, params: (value.params ?? {}) as Record<string, unknown> };
}