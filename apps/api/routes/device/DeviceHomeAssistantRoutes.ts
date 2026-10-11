import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../../bootstrap';
import { syncDeviceStateUseCase } from '../../../../packages/devices/application/syncDeviceStateUseCase';
import type { HomeAssistantReconciliationState } from '../../../../packages/integrations/home-assistant/application/ports/HomeAssistantStateReader';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import { ApiRoutes } from '../ApiRoutes';
import { enrichDevice } from './deviceSerialization';
import { mapHaImportError } from './deviceErrorMapping';
import { buildHaEntityCatalog, parseHaEntityCatalogOptions } from './haEntityCatalog';

/**
 * Home Assistant device routes (admin only):
 * GET /api/v1/ha/entities, POST /api/v1/ha/import, POST /api/v1/devices/:id/refresh
 */
export class DeviceHomeAssistantRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    // GET /api/v1/ha/entities
    if (method === 'GET' && pathname === '/api/v1/ha/entities') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      return this.handleHaDiscovery(req, res, container);
    }

    // POST /api/v1/ha/import
    if (method === 'POST' && pathname === '/api/v1/ha/import') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      return this.handleHaImport(req, res, container);
    }

    // POST /api/v1/devices/:id/refresh
    const refreshMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/refresh$/);
    if (refreshMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const deviceId = refreshMatch[1];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        if (!device.externalId.startsWith('ha:')) {
          return this.sendError(res, 400, 'INVALID_TYPE', 'Only Home Assistant devices can be refreshed via this endpoint'), true;
        }
        const entityId = device.externalId.split(':')[1];
        const haState = await container.adapters.homeAssistantClient.getEntityState(entityId);

        if (!haState) {
          return this.sendError(res, 404, 'HA_ENTITY_NOT_FOUND', 'Home Assistant entity not found'), true;
        }

        container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const newState: Record<string, unknown> = {
          ...device.lastKnownState as Record<string, unknown>,
          state: haState.state,
          attributes: haState.attributes,
        };
        if (haState.state === 'on' || haState.state === 'open') newState.on = true;
        else if (haState.state === 'off' || haState.state === 'closed') newState.on = false;

        if (haState.attributes.current_position !== undefined) {
          newState.current_position = haState.attributes.current_position;
        }

        await syncDeviceStateUseCase(deviceId, newState, req.user!.id, {
          deviceRepository: container.repositories.deviceRepository,
          eventPublisher: container.adapters.deviceEventPublisher,
          activityLogRepository: container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        const updated = await container.repositories.deviceRepository.findDeviceById(deviceId);
        this.sendJson(res, updated ? enrichDevice(updated) : null);
      } catch (error: unknown) {
        container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, 'REFRESH_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    return false;
  }

  private async handleHaDiscovery(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer
  ): Promise<boolean> {
    let allStates: HomeAssistantReconciliationState[] = [];

    try {
      allStates = await container.adapters.homeAssistantClient.getAllStates();
      container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : '';
      const isAuthError = errorMsg.includes('401') || errorMsg.includes('auth_invalid');
      const isUnreachable =
        errorMsg.includes('timeout') ||
        errorMsg.includes('FetchError') ||
        errorMsg.includes('ECONNREFUSED') ||
        errorMsg.includes('ECONNRESET');

      if (isAuthError) {
        container.services.homeAssistantSettingsService.updateStatusFromOperation('auth_error');
      } else if (isUnreachable) {
        container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      }

      return this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error de comunicación con HA: ${errorMsg}`), true;
    }

    try {
      const options = parseHaEntityCatalogOptions(req.url);

      const existingEntityIds = await container.repositories.deviceRepository.findAllExternalIdsByPrefix('ha:');
      const existingEntityIdsSet = new Set(existingEntityIds.map(id => id.replace('ha:', '')));

      this.sendJson(res, buildHaEntityCatalog(allStates, existingEntityIdsSet, options));
    } catch (error: unknown) {
      this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error local de procesamiento: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    return true;
  }

  private async handleHaImport(
    req: HomePilotRequest,
    res: http.ServerResponse,
    container: BootstrapContainer
  ): Promise<boolean> {
    try {
      const payload = await this.parseBody<{ entityId: string; name?: string }>(req);
      if (!payload.entityId) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing entityId'), true;

      const device = await container.services.haImportService.importDevice(
        payload.entityId,
        req.user!.id,
        payload.name
      );

      container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
      this.sendJson(res, enrichDevice(device), 201);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Import Error';
      const { status, code } = mapHaImportError(msg);

      // Only an unexpected failure says anything about connectivity; a duplicate or
      // unknown entity is a normal answer from a Home Assistant that responded.
      if (status >= 500) container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      this.sendError(res, status, code, msg);
    }
    return true;
  }
}
