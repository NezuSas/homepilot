import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';

/**
 * Auth routes: /api/v1/auth/*
 */
export class AuthRoutes extends ApiRoutes {
  async handle(
    req: HomePilotRequest,
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
              type: 'COMMAND_FAILED', // Use existing type logic
              timestamp: new Date().toISOString(),
              description: `Failed login attempt for user ${payload.username}`,
              data: { username: payload.username },
            });
          } catch {
            /* ignore */
          }
          return this.sendError(res, 401, 'AUTH_FAILED', 'Invalid credentials'), true;
        }

        try {
          await container.repositories.activityLogRepository.saveActivity({
            deviceId: 'system-auth',
            type: 'COMMAND_DISPATCHED', // Use existing type logic for session start
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
            displayName: result.user.displayName,
            avatarDataUri: result.user.avatarDataUri,
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
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

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
      this.sendJson(res, req.user);
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
          req.user!.id,
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

    // PATCH /api/v1/auth/me — update own profile (displayName + avatar)
    if (method === 'PATCH' && pathname === '/api/v1/auth/me') {
      try {
        const payload = await this.parseBody<{ displayName?: string | null; avatarDataUri?: string | null }>(req);
        const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() || null : null;
        let finalAvatarDataUri = typeof payload.avatarDataUri === 'string' ? payload.avatarDataUri : null;

        // If the payload contains a raw Base64 data URI (new upload), process it physically
        if (finalAvatarDataUri?.startsWith('data:image/')) {
          const mediaService = new MediaService();
          const savedPath = await mediaService.saveUserAvatar(req.user!.username, finalAvatarDataUri);
          const cacheBuster = Date.now();
          finalAvatarDataUri = `${savedPath}?v=${cacheBuster}`;
        }

        await container.services.userManagementService.updateProfile(req.user!.id, displayName, finalAvatarDataUri);
        const updated = await container.repositories.userRepository.findById(req.user!.id);
        if (!updated) return this.sendError(res, 404, 'USER_NOT_FOUND', 'User not found'), true;
        this.sendJson(res, {
          id: updated.id,
          username: updated.username,
          displayName: updated.displayName,
          avatarDataUri: updated.avatarDataUri,
          role: updated.role,
          isActive: updated.isActive,
        });
      } catch (e: any) {
        this.sendError(res, 500, 'INTERNAL_ERROR', e.message);
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Auth route not found');
    return true;
  }
}
