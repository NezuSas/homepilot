import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';

/**
 * Settings routes: /api/v1/settings/*
 */
export class SettingsRoutes extends ApiRoutes {
  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/settings/')) return false;

    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;
    const authReq = req as any;

    // POST /api/v1/settings/test-ha-connection
    if (method === 'POST' && pathname === '/api/v1/settings/test-ha-connection') {
      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl || !payload.accessToken) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl and accessToken are required'), true;
        }

        const result = await container.services.homeAssistantSettingsService.testConnection(
          payload.baseUrl,
          payload.accessToken
        );

        this.sendJson(res, {
          success: result.success,
          status: result.status,
          ...(result.success ? {} : { error: { code: result.status.toUpperCase(), message: result.error || 'Connection failed' } }),
        });
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to test connection');
      }
      return true;
    }

    // POST /api/v1/settings/home-assistant
    if (method === 'POST' && pathname === '/api/v1/settings/home-assistant') {
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;

      try {
        const payload = await this.parseBody<{ baseUrl?: string; accessToken?: string }>(req);
        if (!payload.baseUrl || !payload.accessToken) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'baseUrl and accessToken are required'), true;
        }

        await container.services.homeAssistantSettingsService.saveSettings(payload.baseUrl, payload.accessToken);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        const msg = e.message || '';
        if (msg.includes('Invalid URL')) {
          return this.sendError(res, 400, 'VALIDATION_ERROR', 'Invalid Home Assistant URL'), true;
        }
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to save Home Assistant settings');
      }
      return true;
    }

    // GET /api/v1/settings/home-assistant
    if (method === 'GET' && pathname === '/api/v1/settings/home-assistant') {
      try {
        const status = await container.services.homeAssistantSettingsService.getStatus();
        const { ...safeStatus } = status;
        this.sendJson(res, safeStatus);
      } catch {
        this.sendError(res, 500, 'HA_CONNECTION_ERROR', 'Failed to get Home Assistant settings');
      }
      return true;
    }

    return false;
  }
}
