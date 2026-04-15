import * as crypto from 'crypto';
import * as http from 'http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { BootstrapContainer } from '../../../bootstrap';
import { createRoomUseCase } from '../../../packages/topology/application/createRoomUseCase';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { ApiRoutes } from './ApiRoutes';

interface LocalRoomRow {
  id: string;
  home_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

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

interface LocalHomeRow {
  id: string;
  owner_id: string;
  name: string;
  entity_version: number;
  created_at: string;
  updated_at: string;
}

/**
 * Topology routes: /api/v1/homes, /api/v1/rooms, /api/v1/homes/:id/rooms
 */
export class TopologyRoutes extends ApiRoutes {
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
    const db = SqliteDatabaseManager.getInstance(this.dbPath);

    // GET /api/v1/rooms
    if (method === 'GET' && pathname === '/api/v1/rooms') {
      try {
        const homes = await container.repositories.homeRepository.findHomesByUserId(authReq.user.id);
        if (homes.length === 0) {
          this.sendJson(res, []);
          return true;
        }

        const homeIds = homes.map((h) => h.id);
        const placeholders = homeIds.map(() => '?').join(',');
        const rows = db
          .prepare(`SELECT * FROM rooms WHERE home_id IN (${placeholders})`)
          .all(...homeIds) as LocalRoomRow[];

        this.sendJson(
          res,
          rows.map((r) => ({
            id: r.id,
            homeId: r.home_id,
            name: r.name,
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

    // GET /api/v1/homes
    if (method === 'GET' && pathname === '/api/v1/homes') {
      try {
        const rows = db.prepare('SELECT * FROM homes').all() as LocalHomeRow[];
        this.sendJson(
          res,
          rows.map((r) => ({
            id: r.id,
            ownerId: r.owner_id,
            name: r.name,
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

    // GET /api/v1/homes/:id/rooms
    const roomsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (roomsMatch) {
      try {
        const homeId = roomsMatch[1];
        const rows = db.prepare('SELECT * FROM rooms WHERE home_id = ?').all(homeId) as LocalRoomRow[];
        this.sendJson(
          res,
          rows.map((r) => ({
            id: r.id,
            homeId: r.home_id,
            name: r.name,
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

    // POST /api/v1/homes/:id/rooms
    const createRoomMatch = method === 'POST' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (createRoomMatch) {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;
      try {
        const homeId = createRoomMatch[1];
        const payload = await this.parseBody<{ name: string }>(req);
        if (!payload.name) return this.sendError(res, 400, 'INVALID_INPUT', 'Room name is required'), true;

        const room = await createRoomUseCase(payload.name, homeId, authReq.user.id, crypto.randomUUID(), {
          homeRepository: container.repositories.homeRepository,
          roomRepository: container.repositories.roomRepository,
          eventPublisher: container.adapters.topologyEventPublisher,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, room, 201);
      } catch (error: any) {
        this.sendError(res, 500, 'ROOM_CREATE_ERROR', error.message);
      }
      return true;
    }

    // POST /api/v1/rooms/:id/action
    const roomActionMatch = method === 'POST' && pathname.match(/^\/api\/v1\/rooms\/([^\/]+)\/action$/);
    if (roomActionMatch) {
      try {
        const roomId = roomActionMatch[1];
        const payload = await this.parseBody<{ action?: string }>(req);
        if (!payload.action || !['turn_on', 'turn_off'].includes(payload.action)) {
          return this.sendError(res, 400, 'INVALID_COMMAND', 'Invalid or missing action'), true;
        }

        const roomDevices = db
          .prepare('SELECT id, type FROM devices WHERE room_id = ?')
          .all(roomId) as LocalDeviceRow[];

        const targetDevices = roomDevices.filter((d) => ['light', 'switch'].includes(d.type));

        if (targetDevices.length === 0) {
          this.sendJson(res, { success: true, executed: 0, failed: 0 });
          return true;
        }

        const compositeDispatcher = container.adapters.commandDispatcher;
        const commandStr = payload.action;
        const correlationId = crypto.randomUUID();

        await container.repositories.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: null,
          correlationId,
          type: 'SCENE_EXECUTION_STARTED' as any,
          description: `User triggered Quick Action on Room`,
          data: { roomId, userId: authReq.user.id, action: commandStr, totalActions: targetDevices.length },
        });

        const results = await Promise.allSettled(
          targetDevices.map((d) =>
            executeDeviceCommandUseCase(
              d.id,
              commandStr,
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
              { customDescription: `Room scene ${commandStr} dispatched.` }
            )
          )
        );

        const structuredFailures: { deviceId: string; reason: string }[] = [];
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            structuredFailures.push({
              deviceId: targetDevices[i].id,
              reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        });

        const failedCount = structuredFailures.length;
        const totalCount = targetDevices.length;
        const succeededCount = totalCount - failedCount;

        const responseBody = {
          success: failedCount === 0,
          total: totalCount,
          succeeded: succeededCount,
          failed: failedCount,
          failures: structuredFailures,
        };

        let resultType = 'SCENE_EXECUTION_COMPLETED' as any;
        if (failedCount === totalCount) resultType = 'SCENE_EXECUTION_FAILED';
        else if (failedCount > 0) resultType = 'SCENE_EXECUTION_FAILED';

        await container.repositories.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: null,
          correlationId,
          type: resultType,
          description: `Room action finished with ${failedCount} failures`,
          data: { roomId, failedCount, totalCount, isPartial: failedCount > 0 && failedCount < totalCount },
        });

        if (failedCount === totalCount) {
          this.sendJson(res, responseBody, 500);
        } else if (failedCount > 0) {
          this.sendJson(res, responseBody, 207);
        } else {
          this.sendJson(res, responseBody, 200);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'ROOM_ACTION_ERROR', error.message);
      }
      return true;
    }

    return false;
  }
}
