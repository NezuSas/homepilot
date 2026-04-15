import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';

/**
 * System routes: /health, /api/v1/system/*
 */
export class SystemRoutes extends ApiRoutes {
  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    // GET /health (public)
    if (method === 'GET' && pathname === '/health') {
      this.sendJson(res, { status: 'ok' });
      return true;
    }

    // GET /api/v1/system/setup-status
    if (method === 'GET' && pathname === '/api/v1/system/setup-status') {
      const isProtected = await container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return true;
      const authReq = req as any;
      if (!container.guards.authGuard.requireRole(authReq, res, 'operator')) return true;

      try {
        const status = await container.services.systemSetupService.getSetupStatus();
        this.sendJson(res, status);
      } catch (e: any) {
        this.sendError(res, 500, 'SETUP_STATUS_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/system/setup-status/complete
    if (method === 'POST' && pathname === '/api/v1/system/setup-status/complete') {
      const isProtected = await container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return true;

      const authReq = req as any;
      if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;

      try {
        await container.services.systemSetupService.completeOnboarding(authReq.user!.id);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        const msg = e.message;
        let code = 'INTERNAL_ERROR';
        let status = 500;

        if (msg === 'NO_CONFIG') {
          code = 'HA_CONFIG_MISSING';
          status = 400;
        } else if (msg === 'AUTH_ERROR') {
          code = 'HA_AUTH_ERROR';
          status = 400;
        } else if (msg === 'UNREACHABLE') {
          code = 'HA_UNREACHABLE';
          status = 400;
        }

        this.sendError(res, status, code, msg);
      }
      return true;
    }

    // GET /api/v1/system/diagnostics
    if (method === 'GET' && pathname === '/api/v1/system/diagnostics') {
      const isProtected = await container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return true;

      try {
        const snapshot = await container.services.diagnosticsService.getSnapshot();
        this.sendJson(res, snapshot);
      } catch (error: any) {
        this.sendError(res, 500, 'DIAGNOSTICS_ERROR', error.message);
      }
      return true;
    }

    // GET /api/v1/system/diagnostics/events
    if (method === 'GET' && pathname === '/api/v1/system/diagnostics/events') {
      const isProtected = await container.guards.authGuard.protect(req as any, res, true);
      if (!isProtected) return true;

      try {
        const events = await container.services.diagnosticsService.getRecentEvents(50);
        this.sendJson(res, events);
      } catch (error: any) {
        this.sendError(res, 500, 'DIAGNOSTICS_EVENTS_ERROR', error.message);
      }
      return true;
    }

    return false;
  }
}
