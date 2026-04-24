import * as http from 'http';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { BootstrapContainer } from '../../../bootstrap';

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

    return false;
  }
}
