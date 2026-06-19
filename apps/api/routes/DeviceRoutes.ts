import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { assignDeviceUseCase } from '../../../packages/devices/application/assignDeviceUseCase';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { syncDeviceStateUseCase } from '../../../packages/devices/application/syncDeviceStateUseCase';
import { DeviceCommandV1, isValidCommand } from '../../../packages/devices/domain/commands';
import { HomeAssistantState } from '../../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { resolveCapabilitiesForDevice } from '../../../packages/devices/domain/CapabilityResolver';
import { Device } from '../../../packages/devices/domain/types';
import { CAPABILITY_DEFINITIONS } from '../../../packages/devices/domain/capabilities';

/**
 * Device routes: /api/v1/devices/*, /api/v1/activity-logs, /api/v1/ha/*
 */
export class DeviceRoutes extends ApiRoutes {
  constructor(private readonly dbPath: string) {
    super();
  }

  /**
   * Helper para enriquecer el dispositivo con sus capacidades resueltas operacionalmente.
   * Incluye la definición completa de comandos y esquemas de parámetros.
   */
  private enrichDevice(device: Device): any {
    const resolvedCapabilities = resolveCapabilitiesForDevice(device);
    const enrichedCapabilities = resolvedCapabilities.map(cap => ({
      ...cap,
      commands: CAPABILITY_DEFINITIONS[cap.type] || []
    }));

    return {
      ...device,
      capabilities: enrichedCapabilities
    };
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/devices/:id/activity-logs
    const deviceLogsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/activity-logs$/);
    if (deviceLogsMatch) {
      try {
        const deviceId = deviceLogsMatch[1];
        const logs = await container.repositories.activityLogRepository.findRecentByDeviceId(deviceId, 20);
        this.sendJson(res, logs);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/devices/:id
    const deviceDetailMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (deviceDetailMatch) {
      try {
        const deviceId = deviceDetailMatch[1];
        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;
        this.sendJson(res, this.enrichDevice(device));
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/devices
    if (method === 'GET' && pathname === '/api/v1/devices') {
      try {
        const devices = await container.repositories.deviceRepository.findAllOrderedByStatus();
        this.sendJson(res, devices.map(d => this.enrichDevice(d)));
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/activity-logs
    if (method === 'GET' && pathname === '/api/v1/activity-logs') {
      try {
        const logs = await container.repositories.activityLogRepository.findAllRecent(50);
        this.sendJson(res, logs);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

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
        let device = await container.repositories.deviceRepository.findDeviceById(deviceId);
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
        this.sendJson(res, updated ? this.enrichDevice(updated) : null);
      } catch (error: unknown) {
        container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, 'REFRESH_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

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
          topologyPort: {
            validateHomeExists: async () => {},
            validateHomeOwnership: async () => {},
            validateRoomBelongsToHome: async (r, h) => {
              const room = await container.repositories.roomRepository.findRoomById(r);
              if (!room) throw new Error('Room not found');
              if (room.homeId !== h) throw new Error('Home mismatch');
            },
          },
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, this.enrichDevice(result));
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : 'Error';
        const msg = error instanceof Error ? error.message : 'Unknown error';
        let code = 'ASSIGN_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError' || msg.includes('not found')) { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'DeviceAlreadyAssignedError' || msg.includes('already assigned')) { status = 409; code = 'ALREADY_ASSIGNED'; }
        this.sendError(res, status, code, msg);
      }
      return true;
    }

    // POST /api/v1/devices/:id/command
    const commandMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/command$/);
    if (commandMatch) {
      try {
        const payload = await this.parseBody<{ command?: string | { name: string; params?: Record<string, unknown> } }>(req);
        if (!payload.command) return this.sendError(res, 400, 'INVALID_COMMAND', 'Missing command'), true;

        const commandName = typeof payload.command === 'string' ? payload.command : payload.command.name;
        if (!isValidCommand(commandName))
          return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid command'), true;
        
        const compositeDispatcher = container.adapters.commandDispatcher;
        const correlationId = crypto.randomUUID();
        await executeDeviceCommandUseCase(
          commandMatch[1],
          payload.command as DeviceCommandV1, // El use case ya soporta ambos por CommandDispatcher
          req.user!.id,
          correlationId,
          {
            deviceRepository: container.repositories.deviceRepository,
            eventPublisher: container.adapters.deviceEventPublisher,
            topologyPort: {
              validateHomeExists: async () => {},
              validateHomeOwnership: async () => {},
              validateRoomBelongsToHome: async () => {},
            },
            dispatcherPort: compositeDispatcher,
            activityLogRepository: container.repositories.activityLogRepository,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() },
          },
          {
            allowPendingManualExecution: true,
          }
        );

        container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const upd = await container.repositories.deviceRepository.findDeviceById(commandMatch[1]);
        this.sendJson(res, upd ? this.enrichDevice(upd) : null);
      } catch (error: unknown) {
        const name = error instanceof Error ? error.constructor.name : 'Error';
        const msg = error instanceof Error ? error.message : 'Unknown error';
        let code = 'COMMAND_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') {
          status = 400;
          code = 'INVALID_COMMAND';
        }

        if (msg.includes('Home Assistant') || msg.includes('fetch')) {
          container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        }

        this.sendError(res, status, code, msg);
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

        const validSemanticTypes = ['light', 'switch', 'outlet', 'cover', 'sensor', 'unknown', null];
        const { semanticType } = payload;

        if (!validSemanticTypes.includes(semanticType as any)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Invalid semanticType value'), true;
        }

        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;

        // Ownership validation
        const home = await container.repositories.homeRepository.findHomeById(device.homeId);
        if (!home || home.ownerId !== req.user!.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        await container.repositories.deviceRepository.updateSemanticType(deviceId, semanticType as any);
        
        const updatedDevice = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!updatedDevice) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;

        this.sendJson(res, { device: this.enrichDevice(updatedDevice) });
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

        // Ownership validation
        const home = await container.repositories.homeRepository.findHomeById(device.homeId);
        if (!home || home.ownerId !== req.user!.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        const nextName = typeof payload.name === 'string' && payload.name.trim().length > 0
          ? payload.name.trim()
          : device.name;
        const nextInvertState = typeof payload.invertState === 'boolean'
          ? payload.invertState
          : device.invertState;

        if (nextName === device.name && nextInvertState === device.invertState) {
          this.sendJson(res, this.enrichDevice(device));
          return true;
        }

        const updatedDevice = {
          ...device,
          name: nextName,
          invertState: nextInvertState,
          updatedAt: new Date().toISOString(),
          entityVersion: device.entityVersion + 1,
        };
        await container.repositories.deviceRepository.saveDevice(updatedDevice);
        this.sendJson(res, this.enrichDevice(updatedDevice));
      } catch (error: unknown) {
        this.sendError(res, 500, 'UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
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
    let allStates: HomeAssistantState[] = [];

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
      const isModeAll = req.url?.includes('mode=all');

      const existingEntityIds = await container.repositories.deviceRepository.findAllExternalIdsByPrefix('ha:');
      const existingEntityIdsSet = new Set(existingEntityIds.map(id => id.replace('ha:', '')));

      const supportedDomains = ['light', 'switch', 'sensor', 'binary_sensor', 'cover'];

      const entities = allStates
        .filter((s) => {
          if (existingEntityIdsSet.has(s.entity_id)) return false;

          const domain = s.entity_id.split('.')[0];
          if (isModeAll) return true;
          return supportedDomains.includes(domain);
        })
        .map((s) => ({
          entityId: s.entity_id,
          state: s.state,
          friendlyName: (s.attributes.friendly_name as string) || s.entity_id,
          domain: s.entity_id.split('.')[0],
          invertState: 0,
          attributes: s.attributes,
        }));

      this.sendJson(res, entities);
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
      this.sendJson(res, this.enrichDevice(device), 201);
    } catch (error: unknown) {
      let status = 500;
      let code = 'IMPORT_ERROR';
      const msg = error instanceof Error ? error.message : 'Import Error';

      if (msg === 'DEVICE_ALREADY_EXISTS') {
        status = 409;
        code = 'DEVICE_ALREADY_EXISTS';
      } else if (msg === 'HOME_NOT_FOUND') {
        status = 404;
        code = 'HOME_NOT_FOUND';
      } else if (msg === 'HA_ENTITY_NOT_FOUND') {
        status = 404;
        code = 'HA_ENTITY_NOT_FOUND';
      }

      container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      this.sendError(res, status, code, msg);
    }
    return true;
  }
}
