import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

export class TuyaRoutes extends ApiRoutes {
  async handle(req: HomePilotRequest, res: http.ServerResponse, pathname: string, method: string, container: BootstrapContainer): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/integrations/tuya')) return false;
    if (!(await container.guards.authGuard.protect(req, res, true))) return true;
    if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;
    const service = container.services.tuyaIntegrationService;
    if (method === 'GET' && pathname === '/api/v1/integrations/tuya/status') { this.sendJson(res, await service.getStatus()); return true; }
    if (method === 'POST' && pathname === '/api/v1/integrations/tuya/authorization') {
      try { const payload = await this.parseBody<{ userCode?: string }>(req); if (!payload.userCode?.trim()) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Tuya user code is required'), true; this.sendJson(res, await service.beginAuthorization(payload.userCode)); }
      catch (error) { this.sendError(res, 400, 'TUYA_AUTHORIZATION_ERROR', error instanceof Error ? error.message : 'Unable to start Tuya authorization'); }
      return true;
    }
    if (method === 'POST' && pathname === '/api/v1/integrations/tuya/authorization/complete') {
      try { const payload = await this.parseBody<{ userCode?: string; qrToken?: string }>(req); if (!payload.userCode?.trim() || !payload.qrToken?.trim()) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Tuya authorization data is required'), true; this.sendJson(res, { authorized: await service.completeAuthorization(payload.userCode, payload.qrToken) }); }
      catch (error) { this.sendError(res, 400, 'TUYA_AUTHORIZATION_ERROR', error instanceof Error ? error.message : 'Unable to complete Tuya authorization'); }
      return true;
    }
    if (method === 'DELETE' && pathname === '/api/v1/integrations/tuya/authorization') { await service.disconnect(); this.sendJson(res, { success: true }); return true; }
    if (method === 'GET' && pathname === '/api/v1/integrations/tuya/covers') { try { this.sendJson(res, await service.listCovers()); } catch (error) { this.sendError(res, 400, 'TUYA_COVERS_ERROR', error instanceof Error ? error.message : 'Unable to load Tuya covers'); } return true; }
    if (method === 'POST' && pathname === '/api/v1/integrations/tuya/covers/import') { try { const payload = await this.parseBody<{ homeId?: string; sourceId?: string; name?: string }>(req); if (!payload.homeId || !payload.sourceId) return this.sendError(res, 400, 'VALIDATION_ERROR', 'homeId and sourceId are required'), true; this.sendJson(res, await service.importCover(payload.homeId, payload.sourceId, payload.name), 201); } catch (error) { this.sendError(res, 400, 'TUYA_IMPORT_ERROR', error instanceof Error ? error.message : 'Unable to import Tuya cover'); } return true; }
    return false;
  }
}