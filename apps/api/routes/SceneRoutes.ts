import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { executeDeviceCommandUseCase } from '../../../packages/devices/application/executeDeviceCommandUseCase';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

/**
 * Scene routes: /api/v1/scenes/*
 */
export class SceneRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/scenes')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/scenes
    if (method === 'GET' && pathname === '/api/v1/scenes') {
      try {
        const urlParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        let homeId = urlParams.get('homeId');
        if (!homeId) {
          const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
          if (homes.length > 0) homeId = homes[0].id;
        }
        if (!homeId) return this.sendJson(res, []), true;

        const scenes = await container.repositories.sceneRepository.findScenesByHomeId(homeId);
        this.sendJson(res, scenes);
      } catch (error: any) {
        this.sendError(res, 500, 'DB_ERROR', error.message);
      }
      return true;
    }

    // POST /api/v1/scenes
    if (method === 'POST' && pathname === '/api/v1/scenes') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<any>(req);
        if (!payload.name || !payload.homeId || !Array.isArray(payload.actions)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing name, homeId, or actions array'), true;
        }
        const newScene = {
          id: crypto.randomUUID(),
          homeId: payload.homeId,
          roomId: payload.roomId || null,
          name: payload.name,
          actions: payload.actions,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.sceneRepository.saveScene(newScene);
        this.sendJson(res, newScene, 201);
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_CREATE_ERROR', error.message);
      }
      return true;
    }

    // PATCH /api/v1/scenes/:id
    const patchSceneMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)$/);
    if (patchSceneMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const sceneId = patchSceneMatch[1];
        const scene = await container.repositories.sceneRepository.findSceneById(sceneId);
        if (!scene) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found'), true;

        const payload = await this.parseBody<any>(req);
        const updated = {
          ...scene,
          name: payload.name ?? scene.name,
          actions: payload.actions ?? scene.actions,
          roomId: payload.roomId !== undefined ? payload.roomId : scene.roomId,
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.sceneRepository.saveScene(updated);
        this.sendJson(res, updated);
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_UPDATE_ERROR', error.message);
      }
      return true;
    }

    // DELETE /api/v1/scenes/:id
    const deleteSceneMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)$/);
    if (deleteSceneMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        await container.repositories.sceneRepository.deleteScene(deleteSceneMatch[1]);
        res.writeHead(204).end();
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_DELETE_ERROR', error.message);
      }
      return true;
    }

    // POST /api/v1/scenes/:id/execute
    const executeSceneMatch = method === 'POST' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)\/execute$/);
    if (executeSceneMatch) {
      try {
        const sceneId = executeSceneMatch[1];
        const scene = await container.repositories.sceneRepository.findSceneById(sceneId);
        if (!scene) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found'), true;

        if (scene.actions.length === 0) {
          return this.sendJson(res, { success: true, executed: 0, failed: 0, failures: [] }), true;
        }

        const compositeDispatcher = container.adapters.commandDispatcher;
        const correlationId = crypto.randomUUID();

        await container.repositories.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: null,
          correlationId,
          type: 'SCENE_EXECUTION_STARTED',
          description: `User triggered Scene "${scene.name}"`,
          data: { sceneId: scene.id, userId: req.user!.id, name: scene.name, totalActions: scene.actions.length },
        });

        const results = await Promise.allSettled(
          scene.actions.map((action: any) =>
            executeDeviceCommandUseCase(
              action.deviceId,
              action.command,
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
              { customDescription: `Persistent Scene "${scene.name}" dispatched: ${action.command}` }
            )
          )
        );

        const structuredFailures: { deviceId: string; reason: string }[] = [];
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            structuredFailures.push({
              deviceId: scene.actions[i].deviceId,
              reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
            });
          }
        });

        const failedCount = structuredFailures.length;
        const totalCount = scene.actions.length;
        const responseBody = {
          success: failedCount === 0,
          total: totalCount,
          succeeded: totalCount - failedCount,
          failed: failedCount,
          failures: structuredFailures,
        };

        let resultType: any = 'SCENE_EXECUTION_COMPLETED';
        if (failedCount === totalCount) resultType = 'SCENE_EXECUTION_FAILED';
        else if (failedCount > 0) resultType = 'SCENE_EXECUTION_FAILED';

        try {
          await container.repositories.activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: resultType,
            description: `Scene "${scene.name}" executed by ${req.user!.username}. (${totalCount - failedCount}/${totalCount} success)`,
            data: {
              sceneId: scene.id,
              sceneName: scene.name,
              userId: req.user!.id,
              totalActions: totalCount,
              failedActions: failedCount,
              failures: structuredFailures,
              isPartial: failedCount > 0 && failedCount < totalCount,
            },
          });
        } catch (logErr: any) {
          console.error('[SceneRoutes] Failed to log scene execution:', logErr.message);
        }

        if (failedCount === totalCount) {
          this.sendJson(res, responseBody, 500);
        } else if (failedCount > 0) {
          this.sendJson(res, responseBody, 207);
        } else {
          this.sendJson(res, responseBody, 200);
        }
      } catch (error: any) {
        this.sendError(res, 500, 'SCENE_EXECUTE_ERROR', error.message);
      }
      return true;
    }

    return false;
  }
}
