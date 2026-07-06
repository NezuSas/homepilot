import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DashboardTab, DashboardVisibility } from '../../../packages/topology/domain/Dashboard';

interface DashboardOwnerSeed {
  id: string;
  username: string;
  displayName: string | null;
  isActive: boolean;
}

/**
 * Dashboard routes: /api/v1/dashboards/*
 */
export class DashboardRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/dashboards')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/dashboards
    if (method === 'GET' && pathname === '/api/v1/dashboards') {
      try {
        let dashboards = await container.services.dashboardService.getDashboardsForUser(
          req.user!.id,
          req.user!.role
        );
        const usersRequiringDashboards: DashboardOwnerSeed[] = req.user!.role === 'admin'
          ? (await container.services.userManagementService.listUsers()).filter(user => user.isActive)
          : [{
              id: req.user!.id,
              username: req.user!.username,
              displayName: req.user!.displayName ?? null,
              isActive: true
            }];
        if (!usersRequiringDashboards.some(user => user.id === req.user!.id)) {
          usersRequiringDashboards.push({
            id: req.user!.id,
            username: req.user!.username,
            displayName: req.user!.displayName ?? null,
            isActive: true
          });
        }

        for (const user of usersRequiringDashboards) {
          const hasDashboard = dashboards.some(dashboard => dashboard.ownerId === user.id);
          if (!hasDashboard) {
            const title = user.displayName?.trim() || user.username;
            await container.services.dashboardService.createDashboard(user.id, title);
          }
        }

        dashboards = await container.services.dashboardService.getDashboardsForUser(
          req.user!.id,
          req.user!.role
        );
        this.sendJson(res, dashboards);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DASHBOARD_ERROR', error instanceof Error ? error.message : 'Failed to load dashboards');
      }
      return true;
    }

    // POST /api/v1/dashboards
    if (method === 'POST' && pathname === '/api/v1/dashboards') {
      try {
        const body = await this.parseBody<{ title?: string }>(req);
        if (!body.title?.trim()) return this.sendError(res, 400, 'VALIDATION_ERROR', 'Title is required'), true;
        const dashboard = await container.services.dashboardService.createDashboard(req.user!.id, body.title);
        this.sendJson(res, dashboard, 201);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create dashboard';
        const status = message === 'DASHBOARD_TITLE_REQUIRED' ? 400 : 500;
        this.sendError(res, status, 'DASHBOARD_ERROR', message);
      }
      return true;
    }

    // PATCH /api/v1/dashboards/:id
    const patchMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)$/);
    if (patchMatch) {
      try {
        const body = await this.parseBody<{
          title?: string;
          tabs?: DashboardTab[];
          visibility?: DashboardVisibility;
        }>(req);
        const updated = await container.services.dashboardService.updateDashboard(
          req.user!.id,
          req.user!.role,
          patchMatch[1],
          body
        );
        this.sendJson(res, updated);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update dashboard';
        const status = message === 'FORBIDDEN' ? 403 : message === 'DASHBOARD_NOT_FOUND' ? 404 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // DELETE /api/v1/dashboards/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)$/);
    if (deleteMatch) {
      try {
        await container.services.dashboardService.deleteDashboard(req.user!.id, req.user!.role, deleteMatch[1]);
        this.sendJson(res, { success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete dashboard';
        const status = message === 'FORBIDDEN' ? 403 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    return false;
  }
}
