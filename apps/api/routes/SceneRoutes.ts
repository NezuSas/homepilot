import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { Scene } from '../../../packages/devices/domain/Scene';
import { SceneExecutionService } from '../../../packages/devices/application/SceneExecutionService';

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
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // POST /api/v1/scenes
    if (method === 'POST' && pathname === '/api/v1/scenes') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const payload = await this.parseBody<{
          name?: string;
          homeId?: string;
          roomId?: string | null;
          actions?: unknown[];
          executionMode?: 'sequential' | 'parallel';
        }>(req);

        if (!payload.name || !payload.homeId || !Array.isArray(payload.actions)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing name, homeId, or actions array'), true;
        }

        const newScene: Scene = {
          id: crypto.randomUUID(),
          homeId: payload.homeId,
          roomId: payload.roomId ?? null,
          name: payload.name,
          actions: payload.actions as Scene['actions'],
          ...(payload.executionMode !== undefined ? { executionMode: payload.executionMode } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.sceneRepository.saveScene(newScene);
        this.sendJson(res, newScene, 201);
      } catch (error: unknown) {
        this.sendError(res, 500, 'SCENE_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
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

        const payload = await this.parseBody<{
          name?: string;
          roomId?: string | null;
          actions?: Scene['actions'];
          executionMode?: 'sequential' | 'parallel';
        }>(req);

        const updated: Scene = {
          ...scene,
          name: payload.name ?? scene.name,
          actions: payload.actions ?? scene.actions,
          roomId: payload.roomId !== undefined ? payload.roomId : scene.roomId,
          ...(payload.executionMode !== undefined
            ? { executionMode: payload.executionMode }
            : {}),
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.sceneRepository.saveScene(updated);
        this.sendJson(res, updated);
      } catch (error: unknown) {
        this.sendError(res, 500, 'SCENE_UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
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
      } catch (error: unknown) {
        this.sendError(res, 500, 'SCENE_DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error');
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
          return this.sendJson(res, {
            sceneId: scene.id,
            status: 'success',
            actions: [],
          }), true;
        }

        const correlationId = crypto.randomUUID();

        await container.repositories.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: null,
          correlationId,
          type: 'SCENE_EXECUTION_STARTED',
          description: `User triggered Scene "${scene.name}"`,
          data: {
            sceneId: scene.id,
            userId: req.user!.id,
            name: scene.name,
            totalActions: scene.actions.length,
            executionMode: scene.executionMode ?? 'parallel',
          },
        });

        const executionService = new SceneExecutionService(container.adapters.commandDispatcher);
        const result = await executionService.execute(scene);

        const failedCount = result.actions.filter(a => a.status === 'failed').length;
        const successCount = result.actions.filter(a => a.status === 'success').length;
        const totalCount = scene.actions.length;

        const resultType =
          result.status === 'success'
            ? 'SCENE_EXECUTION_COMPLETED'
            : 'SCENE_EXECUTION_FAILED';

        try {
          await container.repositories.activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: resultType,
            description: `Scene "${scene.name}" executed by ${req.user!.username}. (${successCount}/${totalCount} success)`,
            data: {
              sceneName: scene.name,
              userName: req.user!.username,
              successCount,
              totalCount,
              sceneId: scene.id,
              userId: req.user!.id,
              totalActions: totalCount,
              failedActions: failedCount,
              isPartial: result.status === 'partial',
              executionMode: scene.executionMode ?? 'parallel',
              actions: result.actions,
            },
          });
        } catch (logErr: unknown) {
          console.error(
            '[SceneRoutes] Failed to log scene execution:',
            logErr instanceof Error ? logErr.message : logErr
          );
        }

        // HTTP status: 200 success / 207 partial / 500 all failed
        if (result.status === 'failed') {
          this.sendJson(res, result, 500);
        } else if (result.status === 'partial') {
          this.sendJson(res, result, 207);
        } else {
          this.sendJson(res, result, 200);
        }
      } catch (error: unknown) {
        this.sendError(res, 500, 'SCENE_EXECUTE_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    return false;
  }
}
