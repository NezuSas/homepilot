import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { syncDeviceStateUseCase } from '../../../../packages/devices/application/syncDeviceStateUseCase';
import { discoverDeviceUseCase } from '../../../../packages/devices/application/discoverDeviceUseCase';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { enrichDevice } from './deviceSerialization';
import { hasValidIntegrationKey } from './deviceIntegrationKey';

/**
 * Machine-to-machine device routes (integration key, no user session):
 * POST /api/v1/integrations/discovery, POST /api/v1/integrations/state-sync
 */
export class DeviceIntegrationRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (method === 'POST' && pathname === '/api/v1/integrations/discovery') {
      if (!hasValidIntegrationKey(req.headers)) {
        this.sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid integration key');
        return true;
      }
      try {
        const payload = await this.parseBody<{ homeId?: unknown; externalId?: unknown; name?: unknown; type?: unknown; vendor?: unknown }>(req);
        const values = [payload.homeId, payload.externalId, payload.name, payload.type, payload.vendor];
        if (!values.every((value): value is string => typeof value === 'string' && Boolean(value.trim()))) {
          this.sendError(res, 400, 'VALIDATION_ERROR', 'Invalid discovery payload');
          return true;
        }
        const device = await discoverDeviceUseCase(values[0], values[1], values[2], values[3], values[4], crypto.randomUUID(), {
          deviceRepository: container.repositories.deviceRepository,
          eventPublisher: container.adapters.deviceEventPublisher,
          topologyPort: container.adapters.topologyReferencePort,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, enrichDevice(device), 201);
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        if (name === 'DeviceConflictError') this.sendError(res, 409, 'DEVICE_ALREADY_EXISTS', message);
        else if (name === 'TopologyResourceNotFoundError') this.sendError(res, 404, 'HOME_NOT_FOUND', message);
        else this.sendError(res, 500, 'INTERNAL_ERROR', message);
      }
      return true;
    }
    if (method === 'POST' && pathname === '/api/v1/integrations/state-sync') {
      if (!hasValidIntegrationKey(req.headers)) {
        this.sendError(res, 401, 'UNAUTHORIZED', 'Missing or invalid integration key');
        return true;
      }

      try {
        const payload = await this.parseBody<{ deviceId?: unknown; state?: unknown }>(req);
        if (typeof payload.deviceId !== 'string' || !payload.deviceId.trim() || typeof payload.state !== 'object' || payload.state === null || Array.isArray(payload.state)) {
          this.sendError(res, 400, 'VALIDATION_ERROR', 'deviceId and a state object are required');
          return true;
        }
        await syncDeviceStateUseCase(payload.deviceId.trim(), payload.state as Record<string, unknown>, 'm2m-state-sync', {
          deviceRepository: container.repositories.deviceRepository,
          eventPublisher: container.adapters.deviceEventPublisher,
          activityLogRepository: container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, { status: 'ok' });
      } catch (error: unknown) {
        const { name, message } = this.getErrorDetails(error);
        if (name === 'DeviceNotFoundError') this.sendError(res, 404, 'DEVICE_NOT_FOUND', message);
        else this.sendError(res, 500, 'INTERNAL_ERROR', message);
      }
      return true;
    }
    return false;
  }
}
