import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';

/**
 * Admin routes: /api/v1/admin/users/*
 */
export class AdminRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/admin/users')) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;
    if (!container.guards.authGuard.requireRole(req, res, 'admin')) return true;

    // GET /api/v1/admin/users
    if (method === 'GET' && pathname === '/api/v1/admin/users') {
      try {
        const users = await container.services.userManagementService.listUsers();
        this.sendJson(res, users);
      } catch (e: any) {
        this.sendError(res, 500, 'USER_LIST_ERROR', e.message);
      }
      return true;
    }

    // POST /api/v1/admin/users
    if (method === 'POST' && pathname === '/api/v1/admin/users') {
      try {
        const payload = await this.parseBody<any>(req);
        const result = await container.services.userManagementService.createUser(req.user!.id, payload);
        this.sendJson(res, result, 201);
      } catch (e: any) {
        let code = 'USER_CREATE_ERROR';
        if (e.message.includes('USERNAME_TAKEN')) code = 'USERNAME_TAKEN';
        else if (e.message.includes('INVALID_INPUT')) code = 'INVALID_INPUT';
        this.sendError(res, 400, code, e.message);
      }
      return true;
    }

    // PATCH /api/v1/admin/users/:id/role
    const patchRoleMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/role$/);
    if (patchRoleMatch) {
      const targetId = patchRoleMatch[1];
      const VALID_ROLES = new Set(['admin', 'parent', 'child', 'guest', 'operator']);
      try {
        const payload = await this.parseBody<{ role: string }>(req);
        if (!payload.role || !VALID_ROLES.has(payload.role)) {
          return this.sendError(res, 400, 'INVALID_ROLE', 'Role must be one of: admin, parent, child, guest, operator'), true;
        }
        await container.services.userManagementService.updateUserRole(req.user!.id, targetId, payload.role as any);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        let status = 400;
        let code = 'USER_ROLE_ERROR';
        if (e.message.includes('USER_NOT_FOUND')) { status = 404; code = 'USER_NOT_FOUND'; }
        else if (e.message.includes('MINIMUM_ADMINS_VIOLATED')) code = 'MINIMUM_ADMINS_VIOLATED';
        this.sendError(res, status, code, e.message);
      }
      return true;
    }

    // PATCH /api/v1/admin/users/:id/active
    const patchActiveMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/active$/);
    if (patchActiveMatch) {
      const targetId = patchActiveMatch[1];
      try {
        const payload = await this.parseBody<{ isActive: boolean }>(req);
        await container.services.userManagementService.setUserActiveState(
          req.user!.id,
          targetId,
          payload.isActive === true
        );
        this.sendJson(res, { success: true });
      } catch (e: any) {
        let status = 400;
        let code = 'USER_STATUS_ERROR';
        if (e.message.includes('USER_NOT_FOUND')) { status = 404; code = 'USER_NOT_FOUND'; }
        else if (e.message.includes('MINIMUM_ADMINS_VIOLATED')) code = 'MINIMUM_ADMINS_VIOLATED';
        else if (e.message.includes('CANNOT_DEACTIVATE_SELF')) code = 'CANNOT_DEACTIVATE_SELF';
        this.sendError(res, status, code, e.message);
      }
      return true;
    }

    // PATCH /api/v1/admin/users/:id/password
    const passwordMatch = method === 'PATCH' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/password$/);
    if (passwordMatch) {
      const targetId = passwordMatch[1];
      try {
        const payload = await this.parseBody<{ newPassword?: string }>(req);
        if (typeof payload.newPassword !== 'string') {
          return this.sendError(res, 400, 'INVALID_INPUT', 'New password is required'), true;
        }
        await container.services.userManagementService.resetUserPassword(req.user!.id, targetId, payload.newPassword);
        this.sendJson(res, { success: true });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Password reset failed';
        if (message.includes('USER_NOT_FOUND')) {
          this.sendError(res, 404, 'USER_NOT_FOUND', message);
        } else if (message.includes('SELF_PASSWORD_CHANGE_REQUIRED')) {
          this.sendError(res, 400, 'SELF_PASSWORD_CHANGE_REQUIRED', message);
        } else if (message.includes('INVALID_INPUT')) {
          this.sendError(res, 400, 'INVALID_INPUT', message);
        } else {
          this.sendError(res, 500, 'USER_PASSWORD_RESET_ERROR', message);
        }
      }
      return true;
    }

    // POST /api/v1/admin/users/:id/revoke-sessions
    const revokeMatch = method === 'POST' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/revoke-sessions$/);
    if (revokeMatch) {
      const targetId = revokeMatch[1];
      try {
        await container.services.userManagementService.revokeUserSessions(req.user!.id, targetId);
        this.sendJson(res, { success: true });
      } catch (e: any) {
        this.sendError(res, e.message.includes('USER_NOT_FOUND') ? 404 : 500, 'USER_REVOKE_ERROR', e.message);
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Admin route not found');
    return true;
  }
}
