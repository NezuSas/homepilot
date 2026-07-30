import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

interface TuyaPayload { endpoint?: string; clientId?: string; clientSecret?: string; userUid?: string; }

export class TuyaRoutes extends ApiRoutes {
  async handle(req: HomePilotRequest, res: http.ServerResponse, pathname: string, method: string, container: BootstrapContainer): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/integrations/tuya')) return false;
    if (!(await container.guards.authGuard.protect(req, res, true))) return true;
    if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
    const service = container.services.tuyaIntegrationService;
    if (method === 'GET' && pathname === '/api/v1/integrations/tuya/status') {
      this.sendJson(res, await service.getStatus()); return true;
    }
    if ((method === 'POST' && pathname === '/api/v1/integrations/tuya/test') || (method === 'PUT' && pathname === '/api/v1/integrations/tuya/settings')) {
      try {
        const payload = await this.parseBody<TuyaPayload>(req);
        if (!payload.endpoint || !payload.clientId || !payload.clientSecret || !payload.userUid) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Tuya endpoint, client ID, client secret and user UID are required'), true;
        const settings = { endpoint: payload.endpoint, clientId: payload.clientId, clientSecret: payload.clientSecret, userUid: payload.userUid };
        if (method === 'POST') await service.test(settings); else await service.save(settings);
        this.sendJson(res, { success: true }); return true;
      } catch (error) { this.sendError(res, 400, 'TUYA_CONFIGURATION_ERROR', error instanceof Error ? error.message : 'Unable to configure Tuya'); return true; }
    }
    if (method === 'GET' && pathname === '/api/v1/integrations/tuya/covers') {
      try { this.sendJson(res, await service.listCovers()); } catch (error) { this.sendError(res, 400, 'TUYA_COVERS_ERROR', error instanceof Error ? error.message : 'Unable to load Tuya covers'); }
      return true;
    }
    if (method === 'POST' && pathname === '/api/v1/integrations/tuya/covers/import') {
      try {
        const payload = await this.parseBody<{ homeId?: string; sourceId?: string; name?: string }>(req);
        if (!payload.homeId || !payload.sourceId) return this.sendError(res, 400, 'VALIDATION_ERROR', 'homeId and sourceId are required'), true;
        this.sendJson(res, await service.importCover(payload.homeId, payload.sourceId, payload.name), 201);
      } catch (error) { this.sendError(res, 400, 'TUYA_IMPORT_ERROR', error instanceof Error ? error.message : 'Unable to import Tuya cover'); }
      return true;
    }
    return false;
  }
}