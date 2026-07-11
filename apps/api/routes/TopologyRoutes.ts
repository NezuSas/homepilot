import * as crypto from 'crypto';
import * as http from 'http';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { BootstrapContainer } from '../../../bootstrap';
import { createHomeUseCase } from '../../../packages/topology/application/createHomeUseCase';
import { createRoomUseCase } from '../../../packages/topology/application/createRoomUseCase';
import { renameRoomUseCase } from '../../../packages/topology/application/renameRoomUseCase';
import { ForbiddenError, NotFoundError } from '../../../packages/topology/application/errors';
import { InvalidHomeNameError, InvalidRoomNameError } from '../../../packages/topology/domain/errors';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

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

interface LocalRoomOwnershipRow {
  room_id: string;
  home_id: string;
  owner_id: string;
  room_name: string;
}

/**
 * Topology routes: /api/v1/homes, /api/v1/rooms, /api/v1/homes/:id/rooms
 */
export class TopologyRoutes extends ApiRoutes {
  constructor(private readonly dbPath: string) {
    super();
  }

  private canReadSharedTopology(role: string): boolean {
    return role === 'admin'
      || role === 'operator'
      || role === 'parent'
      || role === 'child'
      || role === 'guest';
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
    
    const db = SqliteDatabaseManager.getInstance(this.dbPath);

    // GET /api/v1/rooms
    if (method === 'GET' && pathname === '/api/v1/rooms') {
      try {
        const homes = this.canReadSharedTopology(req.user!.role)
          ? await container.repositories.homeRepository.findAll()
          : await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
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
        const homes = this.canReadSharedTopology(req.user!.role)
          ? await container.repositories.homeRepository.findAll()
          : await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        this.sendJson(res, homes);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Failed to load homes');
      }
      return true;
    }

    // POST /api/v1/homes
    if (method === 'POST' && pathname === '/api/v1/homes') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{ name?: string }>(req);
        if (typeof payload.name !== 'string') {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Home name is required'), true;
        }

        const home = await createHomeUseCase(
          payload.name,
          req.user!.id,
          crypto.randomUUID(),
          {
            homeRepository: container.repositories.homeRepository,
            eventPublisher: container.adapters.topologyEventPublisher,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() },
          },
        );
        this.sendJson(res, home, 201);
      } catch (error: unknown) {
        if (error instanceof InvalidHomeNameError) {
          this.sendError(res, 400, 'INVALID_INPUT', error.message);
        } else {
          this.sendError(res, 500, 'HOME_CREATE_ERROR', error instanceof Error ? error.message : 'Home creation failed');
        }
      }
      return true;
    }

    // PATCH /api/v1/homes/:id
    const renameHomeMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)$/);
    if (renameHomeMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{ name?: string }>(req);
        const nextName = typeof payload.name === 'string' ? payload.name.trim() : '';
        if (!nextName) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Home name is required'), true;
        }

        const home = await container.repositories.homeRepository.findHomeById(renameHomeMatch[1]);
        if (!home) return this.sendError(res, 404, 'HOME_NOT_FOUND', 'Home not found'), true;
        if (home.ownerId !== req.user!.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to current user'), true;
        }

        const updatedHome = {
          ...home,
          name: nextName,
          entityVersion: home.entityVersion + 1,
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.homeRepository.saveHome(updatedHome);
        this.sendJson(res, updatedHome);
      } catch (error: unknown) {
        this.sendError(res, 500, 'HOME_RENAME_ERROR', error instanceof Error ? error.message : 'Home rename failed');
      }
      return true;
    }

    // GET /api/v1/homes/:id/rooms
    const roomsMatch = method === 'GET' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (roomsMatch) {
      try {
        const homeId = roomsMatch[1];
        const home = await container.repositories.homeRepository.findHomeById(homeId);
        if (!home) return this.sendError(res, 404, 'HOME_NOT_FOUND', 'Home not found'), true;
        if (home.ownerId !== req.user!.id && !this.canReadSharedTopology(req.user!.role)) {
          return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to current user'), true;
        }
        const rooms = await container.repositories.roomRepository.findRoomsByHomeId(homeId);
        this.sendJson(res, rooms);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Failed to load rooms');
      }
      return true;
    }

    // POST /api/v1/homes/:id/rooms
    const createRoomMatch = method === 'POST' && pathname.match(/^\/api\/v1\/homes\/([^\/]+)\/rooms$/);
    if (createRoomMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const homeId = createRoomMatch[1];
        const payload = await this.parseBody<{ name: string }>(req);
        if (!payload.name) return this.sendError(res, 400, 'INVALID_INPUT', 'Room name is required'), true;

        const room = await createRoomUseCase(payload.name, homeId, req.user!.id, crypto.randomUUID(), {
          homeRepository: container.repositories.homeRepository,
          roomRepository: container.repositories.roomRepository,
          eventPublisher: container.adapters.topologyEventPublisher,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() },
        });
        this.sendJson(res, room, 201);
      } catch (error: unknown) {
        if (error instanceof InvalidRoomNameError) {
          this.sendError(res, 400, 'INVALID_INPUT', error.message);
        } else if (error instanceof NotFoundError) {
          this.sendError(res, 404, 'HOME_NOT_FOUND', error.message);
        } else if (error instanceof ForbiddenError) {
          this.sendError(res, 403, 'FORBIDDEN', error.message);
        } else {
          this.sendError(res, 500, 'ROOM_CREATE_ERROR', error instanceof Error ? error.message : 'Room creation failed');
        }
      }
      return true;
    }

    // PATCH /api/v1/rooms/:id
    const renameRoomMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/rooms\/([^\/]+)$/);
    if (renameRoomMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{ name?: string }>(req);
        if (typeof payload.name !== 'string') {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Room name is required'), true;
        }

        const room = await renameRoomUseCase(
          renameRoomMatch[1],
          payload.name,
          req.user!.id,
          crypto.randomUUID(),
          {
            homeRepository: container.repositories.homeRepository,
            roomRepository: container.repositories.roomRepository,
            eventPublisher: container.adapters.topologyEventPublisher,
            idGenerator: { generate: () => crypto.randomUUID() },
            clock: { now: () => new Date().toISOString() },
          },
        );
        this.sendJson(res, room);
      } catch (error: unknown) {
        if (error instanceof InvalidRoomNameError) {
          this.sendError(res, 400, 'INVALID_INPUT', error.message);
        } else if (error instanceof NotFoundError) {
          this.sendError(res, 404, 'ROOM_NOT_FOUND', error.message);
        } else if (error instanceof ForbiddenError) {
          this.sendError(res, 403, 'FORBIDDEN', error.message);
        } else {
          this.sendError(res, 500, 'ROOM_RENAME_ERROR', error instanceof Error ? error.message : 'Room rename failed');
        }
      }
      return true;
    }

    // DELETE /api/v1/rooms/:id
    const deleteRoomMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/rooms\/([^\/]+)$/);
    if (deleteRoomMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const roomId = deleteRoomMatch[1];
        const ownership = db
          .prepare(`
            SELECT rooms.id AS room_id, rooms.home_id, rooms.name AS room_name, homes.owner_id
            FROM rooms
            INNER JOIN homes ON homes.id = rooms.home_id
            WHERE rooms.id = ?
          `)
          .get(roomId) as LocalRoomOwnershipRow | undefined;

        if (!ownership) {
          this.sendError(res, 404, 'ROOM_NOT_FOUND', 'Room not found');
          return true;
        }

        if (ownership.owner_id !== req.user!.id) {
          this.sendError(res, 403, 'FORBIDDEN', 'Room does not belong to current user');
          return true;
        }

        const deletedAt = new Date().toISOString();
        const deleteRoom = db.transaction(() => {
          const deviceCount = (db
            .prepare('SELECT COUNT(*) AS count FROM devices WHERE room_id = ?')
            .get(roomId) as { count: number }).count;

          db.prepare(`
            UPDATE devices
            SET room_id = NULL,
                status = 'PENDING',
                entity_version = entity_version + 1,
                updated_at = ?
            WHERE room_id = ?
          `).run(deletedAt, roomId);

          db.prepare('DELETE FROM rooms WHERE id = ?').run(roomId);
          return deviceCount;
        });

        const unassignedDevices = deleteRoom();
        this.sendJson(res, {
          deleted: true,
          roomId,
          homeId: ownership.home_id,
          name: ownership.room_name,
          unassignedDevices,
        });
      } catch (error: any) {
        this.sendError(res, 500, 'ROOM_DELETE_ERROR', error.message);
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

        const room = db.prepare('SELECT name FROM rooms WHERE id = ?').get(roomId) as { name: string } | undefined;
        const roomName = room?.name || 'Room';

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
          type: 'SCENE_EXECUTION_STARTED',
          description: `User triggered Quick Action on Room`,
          data: { roomId, userId: req.user!.id, action: commandStr, totalActions: targetDevices.length },
        });

        const results = await Promise.allSettled(
          targetDevices.map((d) =>
            executeDeviceCommandUseCase(
              d.id,
              commandStr,
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

        let resultType: any = 'SCENE_EXECUTION_COMPLETED';
        if (failedCount === totalCount) resultType = 'SCENE_EXECUTION_FAILED';
        else if (failedCount > 0) resultType = 'SCENE_EXECUTION_FAILED';

        await container.repositories.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: null,
          correlationId,
          type: resultType,
          description: `Room action for "${roomName}" finished. (${succeededCount}/${totalCount} success)`,
          data: { 
            roomId, 
            sceneName: roomName, 
            userName: req.user!.username,
            successCount: succeededCount,
            totalCount, 
            failedCount,
            isPartial: failedCount > 0 && failedCount < totalCount 
          },
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
