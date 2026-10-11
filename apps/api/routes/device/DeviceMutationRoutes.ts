import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { assignDeviceUseCase } from '../../../../packages/devices/application/assignDeviceUseCase';
import { removeDeviceUseCase } from '../../../../packages/devices/application/removeDeviceUseCase';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { enrichDevice } from './deviceSerialization';
import { mapAssignError } from './deviceErrorMapping';
import { isAcceptedSemanticType, resolveDevicePatch, semanticTypeConflict } from './devicePatchRules';

/**
 * Admin device mutations: assign, delete, semantic-type and name/invert patch.
 */
export class DeviceMutationRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{ roomId?: string | null }>(req);
        if (payload.roomId === undefined) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing roomId'), true;
        const result = await assignDeviceUseCase(assignMatch[1], payload.roomId, req.user!.id, 'op-console', {
          deviceRepository: container.repositories.deviceRepository,
          eventPublisher: container.adapters.deviceEventPublisher,
          topologyPort: container.adapters.topologyReferencePort,

          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, enrichDevice(result));
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : 'Error';
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const { status, code } = mapAssignError(name, msg);
        this.sendError(res, status, code, msg);
      }
      return true;
    }

    // DELETE /api/v1/devices/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (deleteMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const deviceId = deleteMatch[1];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;

        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== device.homeId) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        await removeDeviceUseCase(deviceId, {
          deviceRepository: container.repositories.deviceRepository,
          sceneRepository: container.repositories.sceneRepository,
          automationRuleRepository: container.repositories.automationRuleRepository,
        });

        this.sendJson(res, { deleted: true, deviceId });
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : 'Error';
        if (name === 'DeviceNotFoundError') {
          return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        }
        if (name === 'DeviceInUseError') {
          return this.sendError(res, 409, 'DEVICE_IN_USE', 'Device is referenced by a scene or automation'), true;
        }
        this.sendError(res, 500, 'DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // PATCH /api/v1/devices/:id/semantic-type
    const semanticPatchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/semantic-type$/);
    if (semanticPatchMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const deviceId = semanticPatchMatch[1];
        const payload = await this.parseBody<Record<string, unknown>>(req);

        if (!('semanticType' in payload)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing semanticType key'), true;
        }

        const { semanticType } = payload;
        if (!isAcceptedSemanticType(semanticType)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Invalid semanticType value'), true;
        }

        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        const conflict = semanticTypeConflict(device.integrationSource, semanticType);
        if (conflict) return this.sendError(res, 400, 'INVALID_INPUT', conflict), true;
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== device.homeId) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        await container.repositories.deviceRepository.updateSemanticType(deviceId, semanticType);

        const updatedDevice = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!updatedDevice) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;

        this.sendJson(res, { device: enrichDevice(updatedDevice) });
      } catch (error: unknown) {
        this.sendError(res, 500, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // PATCH /api/v1/devices/:id
    const devicePatchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (devicePatchMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const deviceId = devicePatchMatch[1];
        const payload = await this.parseBody<{ name?: string; invertState?: boolean }>(req);

        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== device.homeId) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        const next = resolveDevicePatch(device, payload);
        if (!next.changed) {
          this.sendJson(res, enrichDevice(device));
          return true;
        }

        const updatedDevice = {
          ...device,
          name: next.name,
          invertState: next.invertState,
          updatedAt: new Date().toISOString(),
          entityVersion: device.entityVersion + 1,
        };
        await container.repositories.deviceRepository.saveDevice(updatedDevice);
        this.sendJson(res, enrichDevice(updatedDevice));
      } catch (error: unknown) {
        this.sendError(res, 500, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    return false;
  }
}
