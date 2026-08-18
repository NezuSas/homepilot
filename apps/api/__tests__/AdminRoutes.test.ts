import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AdminRoutes } from '../routes/AdminRoutes';

const response = () => ({
  writeHead: jest.fn().mockReturnThis(),
  end: jest.fn().mockReturnThis(),
}) as unknown as http.ServerResponse;

function containerFor(isAdmin: boolean): BootstrapContainer {
  const requireRole = jest.fn((_: HomePilotRequest, res: http.ServerResponse) => {
    if (isAdmin) return true;
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'FORBIDDEN' } }));
    return false;
  });

  return {
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true), requireRole } },
    services: {
      userManagementService: {
        listUsers: jest.fn().mockResolvedValue([
          { id: 'user-1', username: 'operator', displayName: null, avatarDataUri: null, role: 'operator', isActive: true, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', hasActiveSessions: false },
        ]),
      },
    },
  } as unknown as BootstrapContainer;
}

describe('Feature: Administrative user management boundary', () => {
  const routes = new AdminRoutes();

  it('Scenario: Given an operator When the user directory is requested Then access is denied', async () => {
    const res = response();
    const container = containerFor(false);

    await routes.handle({ user: { id: 'operator-1', role: 'operator' } } as HomePilotRequest, res, '/api/v1/admin/users', 'GET', container);

    expect(container.services.userManagementService.listUsers).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('Scenario: Given an administrator When the user directory is requested Then only public user fields are returned', async () => {
    const res = response();
    const container = containerFor(true);

    await routes.handle({ user: { id: 'admin-1', role: 'admin' } } as HomePilotRequest, res, '/api/v1/admin/users', 'GET', container);

    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const body = (res.end as jest.Mock).mock.calls[0][0] as string;
    expect(body).toContain('operator');
    expect(body).not.toContain('passwordHash');
  });
});
function requestWithBody(body: unknown): HomePilotRequest {
  return {
    user: { id: 'admin-1', role: 'admin' },
    headers: { host: 'localhost' },
    _fastifyParsedBody: JSON.stringify(body),
  } as HomePilotRequest;
}

describe('Feature: Administrative user management route outcomes', () => {
  const routes = new AdminRoutes();

  it('creates a valid user and maps duplicate and invalid input errors', async () => {
    const container = containerFor(true);
    const service = container.services.userManagementService as unknown as { createUser: jest.Mock };
    service.createUser = jest.fn().mockResolvedValue({ id: 'new-user' });
    const success = response();

    await routes.handle(requestWithBody({ username: 'new-user' }), success, '/api/v1/admin/users', 'POST', container);
    expect(service.createUser).toHaveBeenCalledWith('admin-1', { username: 'new-user' });
    expect(success.writeHead).toHaveBeenCalledWith(201, expect.any(Object));

    service.createUser.mockRejectedValue(new Error('USERNAME_TAKEN'));
    const duplicate = response();
    await routes.handle(requestWithBody({ username: 'new-user' }), duplicate, '/api/v1/admin/users', 'POST', container);
    expect(duplicate.end).toHaveBeenCalledWith(expect.stringContaining('USERNAME_TAKEN'));

    service.createUser.mockRejectedValue(new Error('INVALID_INPUT'));
    const invalid = response();
    await routes.handle(requestWithBody({ username: '' }), invalid, '/api/v1/admin/users', 'POST', container);
    expect(invalid.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('validates role updates and maps not-found and minimum-admin protections', async () => {
    const container = containerFor(true);
    const service = container.services.userManagementService as unknown as { updateUserRole: jest.Mock };
    service.updateUserRole = jest.fn().mockResolvedValue(undefined);

    const invalid = response();
    await routes.handle(requestWithBody({ role: 'super-admin' }), invalid, '/api/v1/admin/users/user-2/role', 'PATCH', container);
    expect(service.updateUserRole).not.toHaveBeenCalled();
    expect(invalid.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_ROLE'));

    const success = response();
    await routes.handle(requestWithBody({ role: 'parent' }), success, '/api/v1/admin/users/user-2/role', 'PATCH', container);
    expect(service.updateUserRole).toHaveBeenCalledWith('admin-1', 'user-2', 'parent');

    service.updateUserRole.mockRejectedValue(new Error('USER_NOT_FOUND'));
    const missing = response();
    await routes.handle(requestWithBody({ role: 'parent' }), missing, '/api/v1/admin/users/missing/role', 'PATCH', container);
    expect(missing.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

    service.updateUserRole.mockRejectedValue(new Error('MINIMUM_ADMINS_VIOLATED'));
    const protectedAdmin = response();
    await routes.handle(requestWithBody({ role: 'parent' }), protectedAdmin, '/api/v1/admin/users/admin-1/role', 'PATCH', container);
    expect(protectedAdmin.end).toHaveBeenCalledWith(expect.stringContaining('MINIMUM_ADMINS_VIOLATED'));
  });

  it('maps activation, password reset, session revocation, and unknown route errors safely', async () => {
    const container = containerFor(true);
    const service = container.services.userManagementService as unknown as Record<string, jest.Mock>;
    service.setUserActiveState = jest.fn().mockRejectedValue(new Error('CANNOT_DEACTIVATE_SELF'));
    service.resetUserPassword = jest.fn().mockRejectedValue(new Error('SELF_PASSWORD_CHANGE_REQUIRED'));
    service.revokeUserSessions = jest.fn().mockRejectedValue(new Error('USER_NOT_FOUND'));

    const active = response();
    await routes.handle(requestWithBody({ isActive: false }), active, '/api/v1/admin/users/admin-1/active', 'PATCH', container);
    expect(active.end).toHaveBeenCalledWith(expect.stringContaining('CANNOT_DEACTIVATE_SELF'));

    const password = response();
    await routes.handle(requestWithBody({ newPassword: 'new-password' }), password, '/api/v1/admin/users/admin-1/password', 'PATCH', container);
    expect(password.end).toHaveBeenCalledWith(expect.stringContaining('SELF_PASSWORD_CHANGE_REQUIRED'));

    const missingPassword = response();
    await routes.handle(requestWithBody({}), missingPassword, '/api/v1/admin/users/admin-1/password', 'PATCH', container);
    expect(missingPassword.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));

    const revoke = response();
    await routes.handle({ user: { id: 'admin-1', role: 'admin' } } as HomePilotRequest, revoke, '/api/v1/admin/users/missing/revoke-sessions', 'POST', container);
    expect(revoke.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

    const unknown = response();
    await routes.handle({ user: { id: 'admin-1', role: 'admin' } } as HomePilotRequest, unknown, '/api/v1/admin/users/unknown', 'GET', container);
    expect(unknown.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
});
