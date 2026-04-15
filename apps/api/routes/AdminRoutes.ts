import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';

/**
 * Admin routes: /api/v1/admin/users/*
 */
export class AdminRoutes extends ApiRoutes {
  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/admin/users')) return false;

    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;
    const authReq = req as any;
    if (!container.guards.authGuard.requireRole(authReq, res, 'admin')) return true;

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
        const result = await container.services.userManagementService.createUser(authReq.user.id, payload);
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
      try {
        const payload = await this.parseBody<{ role: any }>(req);
        await container.services.userManagementService.updateUserRole(authReq.user.id, targetId, payload.role);
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
          authReq.user.id,
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

    // POST /api/v1/admin/users/:id/revoke-sessions
    const revokeMatch = method === 'POST' && pathname.match(/^\/api\/v1\/admin\/users\/([^\/]+)\/revoke-sessions$/);
    if (revokeMatch) {
      const targetId = revokeMatch[1];
      try {
        await container.services.userManagementService.revokeUserSessions(authReq.user.id, targetId);
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
