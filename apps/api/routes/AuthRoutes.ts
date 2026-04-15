import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';

/**
 * Auth routes: /api/v1/auth/*
 */
export class AuthRoutes extends ApiRoutes {
  async handle(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    if (!pathname.startsWith('/api/v1/auth/')) return false;

    // POST /api/v1/auth/login (public)
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      try {
        const payload = await this.parseBody<{ username?: string; password?: string }>(req);
        if (!payload.username || !payload.password) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing credentials'), true;
        }

        const result = await container.services.authService.login(payload.username, payload.password);

        if (!result) {
          try {
            await container.repositories.activityLogRepository.saveActivity({
              deviceId: 'system-auth',
              type: 'AUTH_FAILED' as any,
              timestamp: new Date().toISOString(),
              description: `Failed login attempt for user ${payload.username}`,
              data: {},
            });
          } catch {
            /* ignore */
          }
          return this.sendError(res, 401, 'AUTH_FAILED', 'Invalid credentials'), true;
        }

        try {
          await container.repositories.activityLogRepository.saveActivity({
            deviceId: 'system-auth',
            type: 'AUTH_SUCCESS' as any,
            timestamp: new Date().toISOString(),
            description: `User ${result.user.username} logged in`,
            data: { username: result.user.username },
          });
        } catch {
          /* ignore */
        }

        this.sendJson(res, {
          token: result.token,
          user: {
            id: result.user.id,
            username: result.user.username,
            role: result.user.role,
            isActive: result.user.isActive,
          },
        });
      } catch {
        this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal Login Error');
      }
      return true;
    }

    // Protected auth routes
    const isProtected = await container.guards.authGuard.protect(req as any, res, true);
    if (!isProtected) return true;

    const authReq = req as any;

    // POST /api/v1/auth/logout
    if (method === 'POST' && pathname === '/api/v1/auth/logout') {
      const token = req.headers['authorization']?.replace('Bearer ', '').trim();
      if (token) {
        await container.services.authService.logout(token);
      }
      this.sendJson(res, { success: true });
      return true;
    }

    // GET /api/v1/auth/me
    if (method === 'GET' && pathname === '/api/v1/auth/me') {
      this.sendJson(res, authReq.user);
      return true;
    }

    // POST /api/v1/auth/change-password
    if (method === 'POST' && pathname === '/api/v1/auth/change-password') {
      try {
        const payload = await this.parseBody<{ currentPassword?: string; newPassword?: string }>(req);
        if (!payload.currentPassword || !payload.newPassword) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing fields'), true;
        }

        const result = await container.services.authService.changePassword(
          authReq.user.id,
          payload.currentPassword,
          payload.newPassword
        );
        if (!result.success) return this.sendError(res, 400, 'AUTH_ERROR', 'Failed to change password'), true;

        this.sendJson(res, { success: true });
      } catch {
        this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal Change Password Error');
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Auth route not found');
    return true;
  }
}
