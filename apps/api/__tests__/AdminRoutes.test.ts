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