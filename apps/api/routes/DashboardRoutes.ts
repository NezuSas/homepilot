import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';

/**
 * Dashboard routes: /api/v1/dashboards/*
 */
export class DashboardRoutes extends ApiRoutes {
  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/dashboards')) return false;

    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;
    const authReq = req as any;

    // GET /api/v1/dashboards
    if (method === 'GET' && pathname === '/api/v1/dashboards') {
      try {
        const dashboards = await container.services.dashboardService.getDashboardsForUser(
          authReq.user.id,
          authReq.user.role
        );
        this.sendJson(res, dashboards);
      } catch (e: any) {
        this.sendError(res, 500, 'DASHBOARD_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/dashboards
    if (method === 'POST' && pathname === '/api/v1/dashboards') {
      try {
        const body = await this.parseBody<{ title?: string }>(req);
        if (!body.title) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Title is required'), true;
        const dashboard = await container.services.dashboardService.createDashboard(authReq.user.id, body.title);
        this.sendJson(res, dashboard, 201);
      } catch (e: any) {
        this.sendError(res, 500, 'DASHBOARD_ERROR', e.message);
      }
      return true;
    }

    // PATCH /api/v1/dashboards/:id
    const patchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)$/);
    if (patchMatch) {
      try {
        const body = await this.parseBody<any>(req);
        const updated = await container.services.dashboardService.updateDashboard(
          authReq.user.id,
          authReq.user.role,
          patchMatch[1],
          body
        );
        this.sendJson(res, updated);
      } catch (e: any) {
        const status = e.message === 'FORBIDDEN' ? 403 : e.message === 'DASHBOARD_NOT_FOUND' ? 404 : 500;
        this.sendError(res, status, e.message, e.message);
      }
      return true;
    }

    // DELETE /api/v1/dashboards/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)$/);
    if (deleteMatch) {
      try {
        await container.services.dashboardService.deleteDashboard(authReq.user.id, authReq.user.role, deleteMatch[1]);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        const status = e.message === 'FORBIDDEN' ? 403 : 500;
        this.sendError(res, status, e.message, e.message);
      }
      return true;
    }

    return false;
  }
}
