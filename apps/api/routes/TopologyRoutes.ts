import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { createHomeUseCase } from '../../../packages/topology/application/createHomeUseCase';
import { createRoomUseCase } from '../../../packages/topology/application/createRoomUseCase';
import { renameRoomUseCase } from '../../../packages/topology/application/renameRoomUseCase';
import { deleteRoomUseCase } from '../../../packages/topology/application/deleteRoomUseCase';
import { ForbiddenError, NotFoundError } from '../../../packages/topology/application/errors';
import { InvalidHomeNameError, InvalidRoomNameError, SingleHomeInstallationError } from '../../../packages/topology/domain/errors';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { ForbiddenOwnershipError, TopologyResourceNotFoundError } from '../../../packages/devices/application/errors';
import { DeviceCommandV1 } from '../../../packages/devices/domain/commands';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { ActivityType } from '../../../packages/devices/domain/repositories/ActivityLogRepository';


/**
 * Topology routes: /api/v1/homes, /api/v1/rooms, /api/v1/homes/:id/rooms
 */
export class TopologyRoutes extends ApiRoutes {
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

        const rooms = (await Promise.all(homes.map((home) => container.repositories.roomRepository.findRoomsByHomeId(home.id)))).flat();
        this.sendJson(res, rooms);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', (error instanceof Error ? error.message : String(error)));
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
        const existingHomes = await container.repositories.homeRepository.findAll();
        if (existingHomes.length > 0) {
          return this.sendError(res, 409, 'SINGLE_HOME_INSTALLATION', 'A home already exists for this installation'), true;
        }

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
          this.sendError(res, 400, 'INVALID_INPUT', (error instanceof Error ? error.message : String(error)));
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
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== home.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to this installation'), true;
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
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== home.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to this installation'), true;
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
          this.sendError(res, 400, 'INVALID_INPUT', (error instanceof Error ? error.message : String(error)));
        } else if (error instanceof NotFoundError) {
          this.sendError(res, 404, 'HOME_NOT_FOUND', (error instanceof Error ? error.message : String(error)));
        } else if (error instanceof ForbiddenError) {
          this.sendError(res, 403, 'FORBIDDEN', (error instanceof Error ? error.message : String(error)));
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
          this.sendError(res, 400, 'INVALID_INPUT', (error instanceof Error ? error.message : String(error)));
        } else if (error instanceof NotFoundError) {
          this.sendError(res, 404, 'ROOM_NOT_FOUND', (error instanceof Error ? error.message : String(error)));
        } else if (error instanceof ForbiddenError) {
          this.sendError(res, 403, 'FORBIDDEN', (error instanceof Error ? error.message : String(error)));
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
        const deletedRoom = await deleteRoomUseCase(roomId, req.user!.id, {
          homeRepository: container.repositories.homeRepository,
          roomRepository: container.repositories.roomRepository,
          clock: { now: () => new Date().toISOString() },
        });

        this.sendJson(res, {
          deleted: true,
          roomId,
          homeId: deletedRoom.room.homeId,
          name: deletedRoom.room.name,
          unassignedDevices: deletedRoom.unassignedDevices,
        });
      } catch (error: unknown) {
        if (error instanceof NotFoundError) {
          this.sendError(res, 404, 'ROOM_NOT_FOUND', 'Room not found');
        } else if (error instanceof ForbiddenError) {
          this.sendError(res, 403, 'FORBIDDEN', 'Room does not belong to current user');
        } else {
          this.sendError(res, 500, 'ROOM_DELETE_ERROR', error instanceof Error ? error.message : String(error));
        }
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

        const room = await container.repositories.roomRepository.findRoomById(roomId);
        const roomName = room?.name || 'Room';
        const roomDevices = (await container.repositories.deviceRepository.findAll()).filter((device) => device.roomId === roomId);
        const targetDevices = roomDevices.filter((device) => ['light', 'switch'].includes(device.type));

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
              commandStr as DeviceCommandV1,
              req.user!.id,
              correlationId,
              {
                deviceRepository: container.repositories.deviceRepository,
                eventPublisher: container.adapters.deviceEventPublisher,
                topologyPort: {
                  validateHomeExists: async (homeId) => {
                    if (!await container.repositories.homeRepository.findHomeById(homeId)) throw new TopologyResourceNotFoundError('Home', homeId);
                  },
                  validateHomeOwnership: async (homeId, userId) => {
                    const targetHome = await container.repositories.homeRepository.findHomeById(homeId);
                    if (!targetHome) throw new TopologyResourceNotFoundError('Home', homeId);
                    const homes = await container.repositories.homeRepository.findHomesByUserId(userId);
                    if (homes[0]?.id !== targetHome.id) throw new ForbiddenOwnershipError(`Forbidden access to home ${homeId}`);
                  },
                  validateRoomBelongsToHome: async (targetRoomId, homeId) => {
                    const targetRoom = await container.repositories.roomRepository.findRoomById(targetRoomId);
                    if (!targetRoom) throw new TopologyResourceNotFoundError('Room', targetRoomId);
                    if (targetRoom.homeId !== homeId) throw new ForbiddenOwnershipError(`Room ${targetRoomId} does not belong to home ${homeId}`);
                  },
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

        let resultType: ActivityType = 'SCENE_EXECUTION_COMPLETED';
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
      } catch (error: unknown) {
        this.sendError(res, 500, 'ROOM_ACTION_ERROR', (error instanceof Error ? error.message : String(error)));
      }
      return true;
    }

    return false;
  }
}
