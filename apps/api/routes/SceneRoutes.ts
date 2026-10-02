import * as crypto from 'crypto';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { Scene } from '../../../packages/devices/domain/Scene';
import { canAccessRoutine, parseRoutineSharedUsers } from '../../../packages/devices/domain/routineAccess';

/**
 * Scene routes: /api/v1/scenes/*
 */
export class SceneRoutes extends ApiRoutes {
  private async validateSharedUsers(raw: unknown, ownerId: string, container: BootstrapContainer): Promise<string[]> {
    const ids = parseRoutineSharedUsers(raw).filter(id => id !== ownerId);
    for (const id of ids) {
      const user = await container.repositories.userRepository.findById(id);
      if (!user?.isActive) throw new Error('INVALID_SHARED_USERS');
    }
    return ids;
  }
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

    if (method === 'GET' && pathname === '/api/v1/scenes/share-users') {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const users = await container.repositories.userRepository.findAll();
        this.sendJson(res, users.filter(user => user.isActive && user.id !== req.user!.id).map(user => ({ id: user.id, name: user.displayName || user.username })));
      } catch {
        this.sendError(res, 500, 'SHARING_DIRECTORY_ERROR', 'Sharing directory unavailable');
      }
      return true;
    }

    // Favorites are a per-user preference over owned or explicitly shared scenes.
    if (pathname === '/api/v1/scenes/favorites' && (method === 'GET' || method === 'PUT')) {
      try {
        const key = 'pref:scene-favorites';
        const memory = container.repositories.assistantMemoryRepository;
        const accessibleHomes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        const homeIds = new Set(accessibleHomes.map((home) => home.id));
        const saved = await memory.findByKey(req.user!.id, key);
        const stored: unknown = saved ? JSON.parse(saved.value) : [];
        const ids = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
        if (method === 'GET') {
          const accessible = await Promise.all(ids.map(async (id) => {
            const scene = await container.repositories.sceneRepository.findSceneById(id);
            return scene && canAccessRoutine(scene, req.user!.id) && homeIds.has(scene.homeId) ? id : null;
          }));
          return this.sendJson(res, {
            sceneIds: accessible.filter((id): id is string => id !== null),
            initialized: saved !== null,
          }), true;
        }
        const payload = await this.parseBody<{ sceneIds?: unknown }>(req);
        if (!Array.isArray(payload?.sceneIds) || payload.sceneIds.length > 200 || payload.sceneIds.some((id) => typeof id !== 'string' || !id.trim()) || new Set(payload.sceneIds).size !== payload.sceneIds.length) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'sceneIds must be a unique array of scene IDs'), true;
        }
        const nextIds = payload.sceneIds as string[];
        for (const id of nextIds) {
          const scene = await container.repositories.sceneRepository.findSceneById(id);
          if (!scene || !canAccessRoutine(scene, req.user!.id) || !homeIds.has(scene.homeId)) {
            return this.sendError(res, 403, 'FORBIDDEN', 'Scene is not accessible'), true;
          }
        }
        await memory.upsert({ userId: req.user!.id, key, value: JSON.stringify(nextIds), valueType: 'json', expiresAt: null });
        return this.sendJson(res, nextIds), true;
      } catch (error: unknown) {
        return this.sendError(res, 500, 'SCENE_FAVORITES_ERROR', error instanceof Error ? error.message : 'Unknown error'), true;
      }
    }

    // GET /api/v1/scenes
    if (method === 'GET' && pathname === '/api/v1/scenes') {
      try {
        const urlParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        let homeId = urlParams.get('homeId');
        if (!homeId) {
          const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
          if (homes.length > 0) homeId = homes[0].id;
        } else {
          const home = await container.repositories.homeRepository.findHomeById(homeId);
          const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
          if (!home || homes[0]?.id !== home.id) {
            return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to this installation'), true;
          }
        }
        if (!homeId) return this.sendJson(res, []), true;

        const scenes = await container.repositories.sceneRepository.findScenesByHomeId(homeId);
        this.sendJson(res, scenes.filter((scene) => canAccessRoutine(scene, req.user!.id)));
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
          description?: string;
          sharedUserIds?: unknown;
          icon?: string;
          homeId?: string;
          roomId?: string | null;
          actions?: unknown[];
          executionMode?: 'sequential' | 'parallel';
        }>(req);

        if (!payload.name || !payload.homeId || !Array.isArray(payload.actions)) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing name, homeId, or actions array'), true;
        }
        if (payload.icon !== undefined && (typeof payload.icon !== 'string' || payload.icon.length > 128 || !/^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.icon))) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Invalid scene icon'), true;
        }

        const home = await container.repositories.homeRepository.findHomeById(payload.homeId);
        if (!home) return this.sendError(res, 404, 'HOME_NOT_FOUND', 'Home not found'), true;
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (homes[0]?.id !== home.id) {
          return this.sendError(res, 403, 'FORBIDDEN', 'Home does not belong to this installation'), true;
        }
        if (payload.actions.length === 0) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'At least one scene action is required'), true;
        }

        const newScene: Scene = {
          id: crypto.randomUUID(),
          homeId: payload.homeId,
          userId: req.user!.id,
          roomId: payload.roomId ?? null,
          name: payload.name,
          description: typeof payload.description === 'string' ? payload.description : undefined,
          sharedUserIds: await this.validateSharedUsers(payload.sharedUserIds, req.user!.id, container),
          ...(payload.icon !== undefined ? { icon: payload.icon } : {}),
          actions: payload.actions as Scene['actions'],
          ...(payload.executionMode !== undefined ? { executionMode: payload.executionMode } : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await container.repositories.sceneRepository.saveScene(newScene);
        this.sendJson(res, newScene, 201);
      } catch (error: unknown) {
        this.sendError(res, error instanceof Error && error.message === 'INVALID_SHARED_USERS' ? 400 : 500, 'SCENE_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
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
        if (!scene || scene.userId !== req.user!.id) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found'), true;

        const payload = await this.parseBody<{
          name?: string;
          description?: string;
          sharedUserIds?: unknown;
          icon?: string;
          roomId?: string | null;
          actions?: Scene['actions'];
          executionMode?: 'sequential' | 'parallel';
        }>(req);
        if (payload.icon !== undefined && (typeof payload.icon !== 'string' || payload.icon.length > 128 || !/^mdi:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(payload.icon))) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Invalid scene icon'), true;
        }

        const updated: Scene = {
          ...scene,
          name: payload.name ?? scene.name,
          description: typeof payload.description === 'string' ? payload.description : scene.description,
          sharedUserIds: payload.sharedUserIds === undefined ? scene.sharedUserIds : await this.validateSharedUsers(payload.sharedUserIds, req.user!.id, container),
          icon: payload.icon ?? scene.icon,
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
        this.sendError(res, error instanceof Error && error.message === 'INVALID_SHARED_USERS' ? 400 : 500, 'SCENE_UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // DELETE /api/v1/scenes/:id
    const deleteSceneMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/scenes\/([^\/]+)$/);
    if (deleteSceneMatch) {
      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
      try {
        const scene = await container.repositories.sceneRepository.findSceneById(deleteSceneMatch[1]);
        if (!scene || scene.userId !== req.user!.id) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found'), true;
        await container.repositories.sceneRepository.deleteScene(scene.id);
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
        if (!scene || !canAccessRoutine(scene, req.user!.id)) return this.sendError(res, 404, 'NOT_FOUND', 'Scene not found'), true;
        const homes = await container.repositories.homeRepository.findHomesByUserId(req.user!.id);
        if (!homes.some(home => home.id === scene.homeId)) return this.sendError(res, 403, 'FORBIDDEN', 'Home is not accessible'), true;

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

        const result = await container.services.sceneExecutionService.execute(scene);

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
