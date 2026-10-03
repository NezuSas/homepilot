import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { DashboardTab, DashboardVisibility } from '../../../packages/topology/domain/Dashboard';
import type { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { validateDashboardGridOptions } from '../../../packages/topology/application/validateDashboardGridOptions';

/**
 * Dashboard routes: /api/v1/dashboards/*
 */
export class DashboardRoutes extends ApiRoutes {
  constructor(private readonly mediaService: MediaService) {
    super();
  }
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
        const currentDashboardOwner = {
          id: req.user!.id,
          username: req.user!.username,
          displayName: req.user!.displayName ?? null,
        };

        const hasDashboard = dashboards.some(dashboard => dashboard.ownerId === currentDashboardOwner.id);
        if (!hasDashboard) {
          const title = currentDashboardOwner.displayName?.trim() || currentDashboardOwner.username;
          try {
            await container.services.dashboardService.createDashboard(currentDashboardOwner.id, title);
          } catch (error) {
            // A concurrent request may have provisioned the same owner already.
            if (!(error instanceof Error) || error.message !== 'DASHBOARD_OWNER_EXISTS') throw error;
          }
        }

        dashboards = await container.services.dashboardService.getDashboardsForUser(
          req.user!.id,
          req.user!.role
        );
        dashboards.sort((a, b) => {
          if (a.ownerId === req.user!.id && b.ownerId !== req.user!.id) return -1;
          if (a.ownerId !== req.user!.id && b.ownerId === req.user!.id) return 1;
          return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
        });
        this.sendJson(res, dashboards);
      } catch (error: unknown) {
        this.sendError(res, 500, 'DASHBOARD_ERROR', error instanceof Error ? error.message : 'Failed to load dashboards');
      }
      return true;
    }

    const tabExportMatch = method === 'GET' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)\/tabs\/([^\/]+)\/export$/);
    const tabImportMatch = method === 'POST' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)\/tabs\/import$/);
    if (tabExportMatch || tabImportMatch) {
      try {
        if (tabExportMatch) {
          this.sendJson(res, await container.services.dashboardService.exportTab(req.user!.id, tabExportMatch[1], tabExportMatch[2]));
        } else if (tabImportMatch) {
          const transfer = await this.parseBody<unknown>(req);
          const requestedLanguage = req.headers['accept-language'];
          const language = Array.isArray(requestedLanguage) ? requestedLanguage[0] : requestedLanguage;
          this.sendJson(res, await container.services.dashboardService.importTab(req.user!.id, tabImportMatch[1], transfer, language ?? 'es'), 201);
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'DASHBOARD_ERROR';
        const status = message === 'FORBIDDEN' ? 403 : message.endsWith('_NOT_FOUND') ? 404
          : message === 'DASHBOARD_IMPORT_INVALID' || message === 'DASHBOARD_IMPORT_UNSUPPORTED_VERSION' || message === 'DASHBOARD_LAYOUT_INVALID' ? 400
            : message === 'DASHBOARD_OWNER_CONFLICT' ? 409 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // GET /api/v1/dashboards/:id/export
    const exportMatch = method === 'GET' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)\/export$/);
    if (exportMatch) {
      try {
        const transfer = await container.services.dashboardService.exportDashboard(req.user!.id, exportMatch[1]);
        this.sendJson(res, transfer);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to export dashboard';
        const status = message === 'FORBIDDEN' ? 403 : message === 'DASHBOARD_NOT_FOUND' ? 404 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // POST /api/v1/dashboards/import
    if (method === 'POST' && pathname === '/api/v1/dashboards/import') {
      try {
        const transfer = await this.parseBody<unknown>(req);
        const requestedLanguage = req.headers['accept-language'];
        const language = Array.isArray(requestedLanguage) ? requestedLanguage[0] : requestedLanguage;
        const dashboard = await container.services.dashboardService.importDashboard(req.user!.id, transfer, language ?? 'es');
        this.sendJson(res, dashboard, 201);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to import dashboard';
        const status = message === 'DASHBOARD_IMPORT_INVALID' || message === 'DASHBOARD_IMPORT_UNSUPPORTED_VERSION'
          || message === 'DASHBOARD_MULTIPLE_DEFAULT_TABS' || message === 'DASHBOARD_LAYOUT_INVALID' ? 400 : message === 'DASHBOARD_OWNER_CONFLICT' ? 409 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // GET /api/v1/dashboards/:id/history
    const historyMatch = method === 'GET' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)\/history$/);
    if (historyMatch) {
      try {
        const revisions = await container.services.dashboardService.getDashboardRevisions(req.user!.id, historyMatch[1]);
        this.sendJson(res, revisions);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to load dashboard history';
        const status = message === 'FORBIDDEN' ? 403 : message === 'DASHBOARD_NOT_FOUND' ? 404 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // POST /api/v1/dashboards/:id/history/:revisionId/restore
    const restoreMatch = method === 'POST' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)\/history\/([^\/]+)\/restore$/);
    if (restoreMatch) {
      try {
        const restored = await container.services.dashboardService.restoreDashboardRevision(
          req.user!.id,
          restoreMatch[1],
          restoreMatch[2],
        );
        this.sendJson(res, restored);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to restore dashboard history';
        const status = message === 'FORBIDDEN'
          ? 403
          : message === 'DASHBOARD_NOT_FOUND' || message === 'DASHBOARD_REVISION_NOT_FOUND'
            ? 404
            : message === 'DASHBOARD_LAYOUT_INVALID' || message === 'DASHBOARD_MULTIPLE_DEFAULT_TABS' ? 400 : 500;
        this.sendError(res, status, message, message);
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
        const status = message === 'DASHBOARD_TITLE_REQUIRED' ? 400 : message === 'DASHBOARD_OWNER_EXISTS' ? 409 : 500;
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

        if (body.tabs && body.tabs.filter((tab) => tab.isDefault).length > 1) {
          return this.sendError(res, 400, 'DASHBOARD_MULTIPLE_DEFAULT_TABS', 'DASHBOARD_MULTIPLE_DEFAULT_TABS'), true;
        }
        if (body.tabs) {
          validateDashboardGridOptions(body.tabs);
          const dashboardId = patchMatch[1];

          // Clean up background files for deleted tabs
          try {
            const existing = await container.services.dashboardService.getOwnedDashboard(
              req.user!.id,
              dashboardId
            );
            if (existing && existing.tabs) {
              const incomingTabsById = new Map(body.tabs.map(t => [t.id, t]));
              for (const oldTab of existing.tabs) {
                const incomingTab = incomingTabsById.get(oldTab.id);
                if (!incomingTab || (oldTab.background && !incomingTab.background)) {
                  await this.mediaService.deleteTabBackground(dashboardId, oldTab.id);
                }
              }
            }
          } catch {}

          // Save new backgrounds
          for (const tab of body.tabs) {
            if (tab.background?.startsWith('data:image/')) {
              const savedPath = await this.mediaService.saveTabBackground(dashboardId, tab.id, tab.background);
              const cacheBuster = Date.now();
              tab.background = `${savedPath}?v=${cacheBuster}`;
            }
          }
        }

        const updated = await container.services.dashboardService.updateDashboard(
          req.user!.id,
          req.user!.role,
          patchMatch[1],
          body
        );
        this.sendJson(res, updated);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update dashboard';
        const status = message === 'FORBIDDEN' ? 403 : message === 'DASHBOARD_NOT_FOUND' ? 404
          : message === 'DASHBOARD_MULTIPLE_DEFAULT_TABS' || message === 'DASHBOARD_LAYOUT_INVALID' ? 400 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    // DELETE /api/v1/dashboards/:id
    const deleteMatch = method === 'DELETE' && pathname.match(/^\/api\/v1\/dashboards\/([^\/]+)$/);
    if (deleteMatch) {
      try {
        const dashboardId = deleteMatch[1];
        await container.services.dashboardService.deleteDashboard(req.user!.id, req.user!.role, dashboardId);
        this.sendJson(res, { success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete dashboard';
        const status = message === 'FORBIDDEN' || message === 'DASHBOARD_OWNED_REQUIRED' ? 403 : 500;
        this.sendError(res, status, message, message);
      }
      return true;
    }

    return false;
  }
}
