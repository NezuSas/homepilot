import * as http from 'http';
import { AuthGuard } from './AuthGuard';
import { AuthService } from '../application/AuthService';
import { HomePilotRequest } from '../../shared/domain/http';

function request(headers: Record<string, string | undefined> = {}): HomePilotRequest {
  return { headers } as unknown as HomePilotRequest;
}

function response(): { response: http.ServerResponse; writeHead: jest.Mock; end: jest.Mock } {
  const writeHead = jest.fn();
  const end = jest.fn();
  writeHead.mockReturnValue({ end });
  return { response: { writeHead } as unknown as http.ServerResponse, writeHead, end };
}

describe('AuthGuard', () => {
  const verifyToken = jest.fn();
  const authService = { verifyToken } as unknown as AuthService;
  const originalEnvironment = process.env.NODE_ENV;

  afterEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = originalEnvironment;
  });

  it('returns missing-token errors only when protection is required', async () => {
    const guard = new AuthGuard(authService);
    const required = response();
    const optional = response();

    await expect(guard.protect(request(), required.response)).resolves.toBe(false);
    expect(required.writeHead).toHaveBeenCalledWith(401, { 'Content-Type': 'application/json' });
    expect(required.end).toHaveBeenCalledWith(expect.stringContaining('MISSING_TOKEN'));
    await expect(guard.protect(request(), optional.response, false)).resolves.toBe(true);
    expect(optional.writeHead).not.toHaveBeenCalled();
  });

  it.each([
    ['expired', 401, 'SESSION_EXPIRED'],
    ['inactive', 403, 'USER_INACTIVE'],
    ['unknown', 401, 'INVALID_TOKEN'],
  ])('maps an invalid %s session to the documented response', async (reason, status, code) => {
    verifyToken.mockResolvedValue({ isValid: false, reason });
    const guard = new AuthGuard(authService);
    const result = response();

    await expect(guard.protect(request({ authorization: 'Bearer token' }), result.response)).resolves.toBe(false);
    expect(result.writeHead).toHaveBeenCalledWith(status, { 'Content-Type': 'application/json' });
    expect(result.end).toHaveBeenCalledWith(expect.stringContaining(code));
  });

  it('attaches the verified session user and handles verification failures safely', async () => {
    verifyToken.mockResolvedValueOnce({
      isValid: true,
      user: { id: 'user-1', username: 'oscar', role: 'parent', displayName: 'Oscar', avatarDataUri: null }
    });
    const guard = new AuthGuard(authService);
    const validRequest = request({ authorization: 'Bearer token' });

    await expect(guard.protect(validRequest, response().response)).resolves.toBe(true);
    expect(validRequest.user).toEqual({ id: 'user-1', username: 'oscar', role: 'parent', displayName: 'Oscar', avatarDataUri: null });

    verifyToken.mockRejectedValueOnce(new Error('database unavailable'));
    const failed = response();
    await expect(guard.protect(request({ authorization: 'Bearer token' }), failed.response)).resolves.toBe(false);
    expect(failed.end).toHaveBeenCalledWith(expect.stringContaining('AUTH_ERROR'));
  });

  it('supports the test-only bypass and enforces role hierarchy or a supplied checker', () => {
    process.env.NODE_ENV = 'test';
    const guard = new AuthGuard(authService);
    const bypassRequest = request({ 'x-hp-test-bypass': 'true' });

    return guard.protect(bypassRequest, response().response).then((allowed) => {
      expect(allowed).toBe(true);
      expect(bypassRequest.user?.role).toBe('admin');

      const roleResponse = response();
      expect(guard.requireRole({ user: { ...bypassRequest.user!, role: 'parent' } } as HomePilotRequest, roleResponse.response, 'child')).toBe(true);
      expect(guard.requireRole({ user: { ...bypassRequest.user!, role: 'guest' } } as HomePilotRequest, roleResponse.response, 'admin')).toBe(false);
      expect(roleResponse.end).toHaveBeenCalledWith(expect.stringContaining('INSUFFICIENT_ROLE'));

      guard.setRoleChecker(() => false);
      expect(guard.requireRole({ user: bypassRequest.user } as HomePilotRequest, response().response, 'guest')).toBe(false);
      expect(guard.requireRole(request(), response().response, 'guest')).toBe(false);
    });
  });
});