import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { ApiRoutes } from './ApiRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import type { LoginAttemptRateLimiter } from '../../../packages/auth/application/LoginAttemptRateLimiter';
import { DirectorySsoError } from '../../../packages/auth/application/DirectorySsoVerifier';

/**
 * Auth routes: /api/v1/auth/*
 */
export class AuthRoutes extends ApiRoutes {
  constructor(
    private readonly mediaService: MediaService,
    private readonly loginAttemptRateLimiter: LoginAttemptRateLimiter
  ) {
    super();
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer
  ): Promise<boolean> {
    const isDirectoryBrowserEntry = pathname === '/sso/directory';
    if (!pathname.startsWith('/api/v1/auth/') && !isDirectoryBrowserEntry) return false;

    // Authentication responses can contain session material and must never be stored by browsers or intermediaries.
    res.setHeader('Cache-Control', 'no-store');

    // Browser-only SSO entry. Directory submits the short-lived assertion in a
    // top-level POST body, so it never reaches a URL, history, Referer or log.
    if (isDirectoryBrowserEntry) {
      if (method !== 'POST') return this.sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed'), true;
      try {
        const rawBody = req._fastifyParsedBody ?? '';
        const token = new URLSearchParams(rawBody).get('token');
        if (!token || token.length > 4096) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing SSO token'), true;
        const result = await container.services.directorySsoService.prepareBrowserHandoff(token);
        const handoff = result.linked ? { sessionToken: result.token } : { directoryToken: token };
        res.setHeader('Set-Cookie', `__Host-hp-directory-sso=${encodeURIComponent(JSON.stringify(handoff))}; Max-Age=60; Path=/; HttpOnly; Secure; SameSite=Lax`);
        res.writeHead(303, { Location: '/' });
        res.end();
      } catch (error: unknown) {
        this.sendDirectorySsoError(res, error);
      }
      return true;
    }

    // POST /api/v1/auth/sso/directory/consume-browser (public, one-time browser handoff)
    if (method === 'POST' && pathname === '/api/v1/auth/sso/directory/consume-browser') {
      const rawCookie = readCookie(req.headers.cookie, '__Host-hp-directory-sso');
      res.setHeader('Set-Cookie', '__Host-hp-directory-sso=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
      if (!rawCookie) return this.sendError(res, 404, 'SSO_HANDOFF_NOT_FOUND', 'SSO handoff not found'), true;
      try {
        const handoff = JSON.parse(decodeURIComponent(rawCookie)) as { sessionToken?: unknown; directoryToken?: unknown };
        if (typeof handoff.sessionToken === 'string') {
          const session = await container.services.authService.verifyToken(handoff.sessionToken);
          if (!session.isValid || !session.user) return this.sendError(res, 401, 'SSO_HANDOFF_INVALID', 'SSO handoff invalid'), true;
          this.sendJson(res, { linked: true, token: handoff.sessionToken, user: this.serializeUser(session.user) });
          return true;
        }
        if (typeof handoff.directoryToken === 'string') {
          this.sendJson(res, { linked: false, token: handoff.directoryToken });
          return true;
        }
      } catch { /* return a non-enumerating error below */ }
      return this.sendError(res, 401, 'SSO_HANDOFF_INVALID', 'SSO handoff invalid'), true;
    }
    // POST /api/v1/auth/sso/directory (public)
    if (method === 'POST' && pathname === '/api/v1/auth/sso/directory') {
      try {
        const payload = await this.parseBody<{ token?: string }>(req);
        if (!payload.token) return this.sendError(res, 400, 'INVALID_INPUT', 'Missing SSO token'), true;
        const result = await container.services.directorySsoService.login(payload.token);
        if (!result.linked) {
          this.sendJson(res, { linked: false });
          return true;
        }
        this.sendJson(res, { linked: true, token: result.token, user: this.serializeUser(result.user) });
      } catch (error: unknown) {
        this.sendDirectorySsoError(res, error);
      }
      return true;
    }
    // POST /api/v1/auth/login (public)
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      try {
        const payload = await this.parseBody<{ username?: string; password?: string; ssoLinkToken?: string }>(req);
        if (!payload.username || !payload.password) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Missing credentials'), true;
        }

        const loginKey = this.createLoginAttemptKey(req, payload.username);
        const retryAfterSeconds = this.loginAttemptRateLimiter.getRetryAfterSeconds(loginKey);
        if (retryAfterSeconds !== null) {
          res.setHeader('Retry-After', retryAfterSeconds.toString());
          return this.sendError(res, 429, 'AUTH_RATE_LIMITED', 'Too many login attempts'), true;
        }

        const result = await container.services.authService.login(
          payload.username,
          payload.password,
          payload.ssoLinkToken
            ? async (user) => container.services.directorySsoService.linkAfterLocalLogin(payload.ssoLinkToken!, user.id)
            : undefined
        );

        if (!result) {
          const lockoutSeconds = this.loginAttemptRateLimiter.registerFailure(loginKey);
          try {
            await container.repositories.activityLogRepository.saveActivity({
              deviceId: 'system-auth',
              type: 'COMMAND_FAILED', // Use existing type logic
              timestamp: new Date().toISOString(),
              description: lockoutSeconds ? 'Login temporarily rate limited' : 'Failed login attempt',
              data: { rateLimited: Boolean(lockoutSeconds) },
            });
          } catch {
            /* ignore */
          }
          if (lockoutSeconds) {
            res.setHeader('Retry-After', lockoutSeconds.toString());
            return this.sendError(res, 429, 'AUTH_RATE_LIMITED', 'Too many login attempts'), true;
          }
          return this.sendError(res, 401, 'AUTH_FAILED', 'Invalid credentials'), true;
        }

        this.loginAttemptRateLimiter.registerSuccess(loginKey);

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
      } catch (error: unknown) {
        if (error instanceof DirectorySsoError) this.sendDirectorySsoError(res, error);
        else this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal Login Error');
      }
      return true;
    }

    // Protected auth routes
    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    // GET /api/v1/auth/sso/links
    if (method === 'GET' && pathname === '/api/v1/auth/sso/links') {
      this.sendJson(res, { links: await container.services.directorySsoService.listLinks(req.user!.id) });
      return true;
    }

    // DELETE /api/v1/auth/sso/links/:directoryAccountId
    const unlinkMatch = pathname.match(/^\/api\/v1\/auth\/sso\/links\/([^/]+)$/);
    if (method === 'DELETE' && unlinkMatch) {
      const directoryAccountId = decodeURIComponent(unlinkMatch[1]);
      const deleted = await container.services.directorySsoService.unlink(directoryAccountId, req.user!.id);
      if (!deleted) return this.sendError(res, 403, 'SSO_LINK_FORBIDDEN', 'Directory link does not belong to this user'), true;
      this.sendJson(res, { success: true });
      return true;
    }
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
        if (payload.newPassword.length < 8) {
          return this.sendError(res, 400, 'INVALID_INPUT', 'Password must be at least 8 characters long'), true;
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
          const savedPath = await this.mediaService.saveUserAvatar(req.user!.username, finalAvatarDataUri);
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
      } catch (error: unknown) {
        this.sendError(res, 500, 'INTERNAL_ERROR', this.getErrorDetails(error).message);
      }
      return true;
    }

    this.sendError(res, 404, 'NOT_FOUND', 'Auth route not found');
    return true;
  }

  private serializeUser(user: { id: string; username: string; displayName: string | null; avatarDataUri: string | null; role: string; isActive: boolean }) {
    return { id: user.id, username: user.username, displayName: user.displayName, avatarDataUri: user.avatarDataUri, role: user.role, isActive: user.isActive };
  }

  private sendDirectorySsoError(res: http.ServerResponse, error: unknown): void {
    if (error instanceof DirectorySsoError) {
      this.sendError(res, error.code === 'SSO_NOT_CONFIGURED' ? 503 : 401, error.code, 'Directory SSO token is not valid');
      return;
    }
    this.sendError(res, 500, 'INTERNAL_ERROR', 'Directory SSO login failed');
  }
  private createLoginAttemptKey(req: HomePilotRequest, username: string): string {
    const normalizedUsername = username.trim().toLocaleLowerCase().slice(0, 80);
    const clientAddress = req.socket.remoteAddress ?? 'unknown';
    return `${normalizedUsername}|${clientAddress}`;
  }
}

function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const prefix = `${name}=`;
  for (const item of header.split(';')) {
    const value = item.trim();
    if (value.startsWith(prefix)) return value.slice(prefix.length);
  }
  return null;
}