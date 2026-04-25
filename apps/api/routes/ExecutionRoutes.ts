import * as http from 'http';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { BootstrapContainer } from '../../../bootstrap';
import { Scene } from '../../../packages/devices/domain/Scene';

/**
 * Execution routes: /api/v1/executions/*
 * 
 * Proporciona trazabilidad histórica de ejecuciones de escenas y automatizaciones.
 */
export class ExecutionRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/executions')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/executions/recent?limit=50
    if (method === 'GET' && pathname === '/api/v1/executions/recent') {
      try {
        const urlParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        const limit = parseInt(urlParams.get('limit') || '50', 10);
        
        const records = await container.repositories.executionRecordRepository.findRecent(limit);
        this.sendJson(res, records);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // GET /api/v1/executions/:sourceType/:sourceId?limit=50
    const sourceMatch = method === 'GET' && pathname.match(/^\/api\/v1\/executions\/([^\/]+)\/([^\/]+)$/);
    if (sourceMatch) {
      try {
        const sourceTypeRaw = sourceMatch[1];
        const sourceId = sourceMatch[2];
        
        if (!['scene', 'automation', 'manual'].includes(sourceTypeRaw)) {
          return this.sendError(res, 400, 'INVALID_SOURCE_TYPE', 'Source type must be scene, automation or manual'), true;
        }

        const sourceType = sourceTypeRaw as 'scene' | 'automation' | 'manual';
        const urlParams = new URL(req.url!, `http://${req.headers.host}`).searchParams;
        const limit = parseInt(urlParams.get('limit') || '50', 10);

        const records = await container.repositories.executionRecordRepository.findBySource(sourceType, sourceId, limit);
        this.sendJson(res, records);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DB_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    // POST /api/v1/executions/:executionId/actions/:actionIndex/retry
    const retryMatch = method === 'POST' && pathname.match(/^\/api\/v1\/executions\/([^\/]+)\/actions\/(\d+)\/retry$/);
    if (retryMatch) {
      try {
        const executionId = retryMatch[1];
        const actionIndex = parseInt(retryMatch[2], 10);

        const record = await container.repositories.executionRecordRepository.findById(executionId);
        if (!record) {
          return this.sendError(res, 404, 'EXECUTION_NOT_FOUND', 'Execution record not found'), true;
        }

        const action = record.actions[actionIndex];
        if (!action) {
          return this.sendError(res, 404, 'ACTION_NOT_FOUND', `Action at index ${actionIndex} not found`), true;
        }

        if (action.status !== 'failed') {
          return this.sendError(res, 400, 'RETRY_NOT_ALLOWED', 'Can only retry failed actions'), true;
        }

        if (!action.command) {
          return this.sendError(res, 500, 'MISSING_COMMAND', 'Action command data missing from history'), true;
        }

        // Reconstruir escena sintética con una sola acción
        const now = new Date().toISOString();
        const syntheticScene: Scene = {
          id: `retry-from-${executionId}`,
          name: `Retry: ${action.commandName} on ${action.deviceId}`,
          homeId: "system",
          roomId: null,
          actions: [
            {
              deviceId: action.deviceId,
              command: action.command,
            },
          ],
          executionMode: "parallel",
          createdAt: now,
          updatedAt: now,
        };

        const timestamp = Date.now();
        const retryResult = await container.services.sceneExecutionService.execute(syntheticScene, {
          sourceType: 'manual',
          sourceId: `retry:${executionId}:${actionIndex}`,
          correlationId: `retry:${executionId}:${actionIndex}:${timestamp}`
        });

        this.sendJson(res, retryResult);
      } catch (error: unknown) {
        this.sendError(res, 500, 'RETRY_ERROR', error instanceof Error ? error.message : 'Unknown error');
      }
      return true;
    }

    return false;
  }
}
