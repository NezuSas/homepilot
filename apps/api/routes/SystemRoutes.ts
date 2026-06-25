import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

/**
 * System routes: /health, /api/v1/system/*
 */
export class SystemRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
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
      try {
        const status = await container.services.systemSetupService.getSetupStatus();
        if (status.hasAdminUser) {
          const isProtected = await container.guards.authGuard.protect(req, res, true);
          if (!isProtected) return true;
          if (!container.guards.authGuard.requireRole(req, res, 'operator')) return true;
        }
        this.sendJson(res, status);
      } catch (e: any) {
        this.sendError(res, 500, 'SETUP_STATUS_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/system/bootstrap-admin
    if (method === 'POST' && pathname === '/api/v1/system/bootstrap-admin') {
      try {
        const payload = await this.parseBody<{ username?: string; password?: string; displayName?: string | null }>(req);
        if (!payload.username || !payload.password) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing admin username or password'), true;
        }

        const result = await container.services.authService.bootstrapFirstAdmin({
          username: payload.username,
          password: payload.password,
          displayName: payload.displayName
        });

        if (!result) {
          return this.sendError(res, 409, 'ADMIN_ALREADY_EXISTS', 'Initial administrator already exists'), true;
        }

        try {
          await container.repositories.activityLogRepository.saveActivity({
            deviceId: 'system-setup',
            type: 'ONBOARDING_STARTED',
            timestamp: new Date().toISOString(),
            description: 'Initial administrator created from first-run setup',
            data: { userId: result.user.id, username: result.user.username }
          });
        } catch {
          /* ignore activity log failures during first-run auth */
        }

        this.sendJson(res, {
          token: result.token,
          user: {
            id: result.user.id,
            username: result.user.username,
            displayName: result.user.displayName,
            avatarDataUri: result.user.avatarDataUri,
            role: result.user.role,
            isActive: result.user.isActive
          }
        });
      } catch (e: any) {
        const msg = e.message;
        if (msg === 'INVALID_USERNAME') {
          return this.sendError(res, 400, 'INVALID_USERNAME', 'Username must be 3-40 characters and use letters, numbers, dots, hyphens or underscores'), true;
        }
        if (msg === 'WEAK_PASSWORD') {
          return this.sendError(res, 400, 'WEAK_PASSWORD', 'Password must contain at least 10 characters'), true;
        }
        this.sendError(res, 500, 'BOOTSTRAP_ADMIN_ERROR', msg);
      }
      return true;
    }

    // POST /api/v1/system/setup-status/complete
    if (method === 'POST' && pathname === '/api/v1/system/setup-status/complete') {
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

      try {
        await container.services.systemSetupService.completeOnboarding(req.user!.id);
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
      const isProtected = await container.guards.authGuard.protect(req, res, true);
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
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      try {
        const events = await container.services.diagnosticsService.getRecentEvents(50);
        this.sendJson(res, events);
      } catch (error: any) {
        this.sendError(res, 500, 'DIAGNOSTICS_EVENTS_ERROR', error.message);
      }
      return true;
    }

    // GET /api/v1/system/timezone
    if (method === 'GET' && pathname === '/api/v1/system/timezone') {
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      try {
        const timezone = await container.services.systemVariableService.getSystemTimezone();
        this.sendJson(res, { timezone });
      } catch (e: any) {
        this.sendError(res, 500, 'TIMEZONE_GET_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/system/timezone
    if (method === 'POST' && pathname === '/api/v1/system/timezone') {
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

      try {
        const body = await this.parseBody<{ timezone: string }>(req);
        if (!body.timezone) throw new Error('MISSING_TIMEZONE');

        await container.services.systemVariableService.set({
          scope: 'global',
          name: 'system_timezone',
          value: body.timezone,
          valueType: 'string',
          description: 'System-wide appliance timezone'
        });

        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, 400, 'TIMEZONE_UPDATE_ERROR', e.message);
      }
      return true;
    }

    // GET /api/v1/system/backups
    if (method === 'GET' && pathname === '/api/v1/system/backups') {
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

      try {
        const backups = await container.services.databaseBackupService.listBackups();
        this.sendJson(res, backups);
      } catch (e: any) {
        this.sendError(res, 500, 'BACKUP_LIST_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/system/backups
    if (method === 'POST' && pathname === '/api/v1/system/backups') {
      const isProtected = await container.guards.authGuard.protect(req, res, true);
      if (!isProtected) return true;

      if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

      try {
        const result = await container.services.databaseBackupService.createBackup();
        if (result.success) {
          this.sendJson(res, result.backup);
        } else {
          this.sendError(res, 500, 'BACKUP_CREATE_ERROR', result.error);
        }
      } catch (e: any) {
        this.sendError(res, 500, 'BACKUP_CREATE_ERROR', e.message);
      }
      return true;
    }

    return false;
  }
}
