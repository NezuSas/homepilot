import * as crypto from 'crypto';
import * as http from 'http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { BootstrapContainer } from '../../../bootstrap';
import { assignDeviceUseCase } from '../../../packages/devices/application/assignDeviceUseCase';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { syncDeviceStateUseCase } from '../../../packages/devices/application/syncDeviceStateUseCase';
import { DeviceCommandV1, isValidCommand } from '../../../packages/devices/domain/commands';
import { HomeAssistantState } from '../../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import { ApiRoutes } from './ApiRoutes';

interface LocalDeviceRow {
  id: string;
  home_id: string;
  room_id: string | null;
  external_id: string;
  name: string;
  type: string;
  vendor: string;
  status: string;
  last_known_state: string | null;
  invert_state: number;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Device routes: /api/v1/devices/*, /api/v1/activity-logs, /api/v1/ha/*
 */
export class DeviceRoutes extends ApiRoutes {
  constructor(private readonly dbPath: string) {
    super();
  }

  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;
    const authReq = req as any;

    // GET /api/v1/devices/:id/activity-logs
    const deviceLogsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/activity-logs$/);
    if (deviceLogsMatch) {
      try {
        const deviceId = deviceLogsMatch[1];
        const logs = await container.repositories.activityLogRepository.findRecentByDeviceId(deviceId, 20);
        this.sendJson(res, logs);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
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
        this.sendJson(res, device);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return true;
    }

    // GET /api/v1/devices
    if (method === 'GET' && pathname === '/api/v1/devices') {
      try {
        const db = SqliteDatabaseManager.getInstance(this.dbPath);
        const rows = db
          .prepare('SELECT * FROM devices ORDER BY status DESC, created_at DESC')
          .all() as LocalDeviceRow[];
        this.sendJson(
          res,
          rows.map((r) => ({
            id: r.id,
            homeId: r.home_id,
            roomId: r.room_id,
            externalId: r.external_id,
            name: r.name,
            type: r.type,
            vendor: r.vendor,
            status: r.status,
            invertState: r.invert_state === 1,
            lastKnownState: r.last_known_state ? JSON.parse(r.last_known_state) : null,
            entityVersion: r.entity_version,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
          }))
        );
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return true;
    }

    // GET /api/v1/activity-logs
    if (method === 'GET' && pathname === '/api/v1/activity-logs') {
      try {
        const logs = await container.repositories.activityLogRepository.findAllRecent(50);
        this.sendJson(res, logs);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return true;
    }

    // GET /api/v1/ha/entities
    if (method === 'GET' && pathname === '/api/v1/ha/entities') {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      return this.handleHaDiscovery(req, res, container);
    }

    // POST /api/v1/ha/import
    if (method === 'POST' && pathname === '/api/v1/ha/import') {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      return this.handleHaImport(req, res, container, authReq);
    }

    // POST /api/v1/devices/:id/refresh
    const refreshMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/refresh$/);
    if (refreshMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
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
          container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
          return this.sendError(res, 502, 'HA_UNREACHABLE', 'Could not retrieve state from Home Assistant'), true;
        }

        container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');

        const newState: Record<string, unknown> = { ...device.lastKnownState };
        if (haState.state === 'on') newState.on = true;
        else if (haState.state === 'off') newState.on = false;

        await syncDeviceStateUseCase(deviceId, newState, authReq.user.id, {
          deviceRepository: container.repositories.deviceRepository,
          eventPublisher: container.adapters.deviceEventPublisher,
          activityLogRepository: container.repositories.activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        const updated = await container.repositories.deviceRepository.findDeviceById(deviceId);
        this.sendJson(res, updated);
      } catch (error: any) {
        container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        this.sendError(res, 500, 'REFRESH_ERROR', error.message);
      }
      return true;
    }

    // POST /api/v1/devices/:id/assign
    const assignMatch = method === 'POST' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)\/assign$/);
    if (assignMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{ roomId?: string | null }>(req);
        if (payload.roomId === undefined) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing roomId'), true;
        const result = await assignDeviceUseCase(assignMatch[1], payload.roomId, authReq.user.id, 'op-console', {
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
        this.sendJson(res, result);
      } catch (error: any) {
        const name = error.constructor.name;
        const msg = error.message;
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
        const payload = await this.parseBody<{ command?: string }>(req);
        if (!payload.command || !isValidCommand(payload.command))
          return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid or missing command'), true;
        const compositeDispatcher = container.adapters.commandDispatcher;
        const correlationId = crypto.randomUUID();
        await executeDeviceCommandUseCase(
          commandMatch[1],
          payload.command as DeviceCommandV1,
          authReq.user.id,
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
        this.sendJson(res, upd);
      } catch (error: any) {
        const name = error.constructor.name;
        let code = 'COMMAND_ERROR';
        let status = 500;
        if (name === 'DeviceNotFoundError') { status = 404; code = 'DEVICE_NOT_FOUND'; }
        else if (name === 'UnsupportedCommandError' || name === 'InvalidDeviceCommandError') {
          status = 400;
          code = 'INVALID_COMMAND';
        }

        if (error.message.includes('Home Assistant') || error.message.includes('fetch')) {
          container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
        }

        this.sendError(res, status, code, error.message);
      }
      return true;
    }

    // PATCH /api/v1/devices/:id
    const devicePatchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/devices\/([^\/]+)$/);
    if (devicePatchMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      try {
        const deviceId = devicePatchMatch[1];
        const payload = await this.parseBody<{ name?: string }>(req);

        const device = await container.repositories.deviceRepository.findDeviceById(deviceId);
        if (!device) return this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Device not found'), true;

        // Ownership validation
        const home = await container.repositories.homeRepository.findHomeById(device.homeId);
        if (!home || home.ownerId !== authReq.user.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'No tiene permisos sobre este dispositivo'), true;
        }

        if (payload.name) {
          const updatedDevice = {
            ...device,
            name: payload.name,
            updatedAt: new Date().toISOString(),
            entityVersion: device.entityVersion + 1,
          };
          await container.repositories.deviceRepository.saveDevice(updatedDevice);
          this.sendJson(res, updatedDevice);
        } else {
          this.sendJson(res, device);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'UPDATE_ERROR', error.message);
      }
      return true;
    }

    return false;
  }

  private async handleHaDiscovery(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    container: BootstrapContainer
  ): Promise<boolean> {
    const db = SqliteDatabaseManager.getInstance(this.dbPath);
    let allStates: HomeAssistantState[] = [];

    try {
      allStates = await container.adapters.homeAssistantClient.getAllStates();
      container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
    } catch (error: any) {
      const errorMsg = error.message || '';
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

      return this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error de comunicación con HA: ${error.message}`), true;
    }

    try {
      const isModeAll = req.url?.includes('mode=all');

      const existingRows = db
        .prepare('SELECT external_id FROM devices WHERE external_id LIKE ?')
        .all('ha:%') as { external_id: string }[];
      const existingEntityIds = new Set(existingRows.map((r) => r.external_id.replace('ha:', '')));

      const supportedDomains = ['light', 'switch', 'sensor', 'binary_sensor', 'cover'];

      const entities = allStates
        .filter((s) => {
          const domain = s.entity_id.split('.')[0];
          if (isModeAll) return true;
          return supportedDomains.includes(domain) && !existingEntityIds.has(s.entity_id);
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
    } catch (error: any) {
      this.sendError(res, 502, 'HA_DISCOVERY_ERROR', `Error local de procesamiento: ${error.message}`);
    }
    return true;
  }

  private async handleHaImport(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    container: BootstrapContainer,
    authReq: any
  ): Promise<boolean> {
    try {
      const payload = await this.parseBody<{ entityId: string; name?: string }>(req);
      if (!payload.entityId) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing entityId'), true;

      const device = await container.services.haImportService.importDevice(
        payload.entityId,
        authReq.user.id,
        payload.name
      );

      container.services.homeAssistantSettingsService.updateStatusFromOperation('reachable');
      this.sendJson(res, device, 201);
    } catch (error: any) {
      let status = 500;
      let code = 'IMPORT_ERROR';

      if (error.message === 'DEVICE_ALREADY_EXISTS') {
        status = 409;
        code = 'DEVICE_ALREADY_EXISTS';
      } else if (error.message === 'HOME_NOT_FOUND') {
        status = 404;
        code = 'HOME_NOT_FOUND';
      } else if (error.message === 'HA_ENTITY_NOT_FOUND') {
        status = 404;
        code = 'HA_ENTITY_NOT_FOUND';
      }

      container.services.homeAssistantSettingsService.updateStatusFromOperation('unreachable');
      this.sendError(res, status, code, error.message || 'Import Error');
    }
    return true;
  }
}
