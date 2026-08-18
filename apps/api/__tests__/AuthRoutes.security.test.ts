import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { LoginAttemptRateLimiter } from '../../../packages/auth/application/LoginAttemptRateLimiter';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AuthRoutes } from '../routes/AuthRoutes';
import { DirectorySsoError } from '../../../packages/auth/application/DirectorySsoVerifier';

class MockResponse extends EventEmitter {
  public readonly headers = new Map<string, string>();
  public readonly writeHead = jest.fn().mockReturnThis();
  public readonly end = jest.fn().mockReturnThis();

  public setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

function createRequest(): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.url = '/api/v1/auth/login';
  request.method = 'POST';
  request.headers = {};
  request.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  request._fastifyParsedBody = JSON.stringify({ username: 'owner', password: 'invalid' });
  return request;
}

function createContainer(): BootstrapContainer {
  return {
    services: { authService: { login: jest.fn().mockResolvedValue(null) } },
    repositories: { activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) } },
  } as unknown as BootstrapContainer;
}

describe('Feature: protección de inicio de sesión', () => {
  it('Scenario: Given credenciales fallidas When se excede el límite Then bloquea nuevos intentos con 429 y Retry-After', async () => {
    const limiter = new LoginAttemptRateLimiter({ maxFailures: 1, lockoutMs: 60_000 });
    const routes = new AuthRoutes(new MediaService(), limiter);
    const container = createContainer();

    const lockoutResponse = new MockResponse();
    await routes.handle(createRequest(), lockoutResponse as unknown as http.ServerResponse, '/api/v1/auth/login', 'POST', container);
    expect(lockoutResponse.writeHead).toHaveBeenCalledWith(429, { 'Content-Type': 'application/json' });
    expect(lockoutResponse.headers.get('Retry-After')).toBe('60');

    const blockedResponse = new MockResponse();
    await routes.handle(createRequest(), blockedResponse as unknown as http.ServerResponse, '/api/v1/auth/login', 'POST', container);

    expect(blockedResponse.writeHead).toHaveBeenCalledWith(429, { 'Content-Type': 'application/json' });
    expect(blockedResponse.headers.get('Retry-After')).toBe('60');
    expect(blockedResponse.headers.get('Cache-Control')).toBe('no-store');
  });
  it('Scenario: Given an authenticated user When managing session and profile endpoints Then each action uses the current identity', async () => {
    const limiter = new LoginAttemptRateLimiter();
    const routes = new AuthRoutes({ saveUserAvatar: jest.fn() } as unknown as MediaService, limiter);
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      services: {
        authService: {
          logout: jest.fn().mockResolvedValue(undefined),
          changePassword: jest.fn().mockResolvedValue({ success: true }),
        },
        directorySsoService: {
          listLinks: jest.fn().mockResolvedValue([{ directoryAccountId: 'directory-1' }]),
          unlink: jest.fn().mockResolvedValue(true),
        },
        userManagementService: { updateProfile: jest.fn().mockResolvedValue(undefined) },
      },
      repositories: {
        userRepository: { findById: jest.fn().mockResolvedValue({
          id: 'owner-1', username: 'owner', displayName: 'Owner', avatarDataUri: null, role: 'admin', isActive: true,
        }) },
      },
    } as unknown as BootstrapContainer;
    const authenticatedRequest = (body: unknown, url: string) => {
      const request = createRequest();
      request.url = url;
      request.headers = { authorization: 'Bearer session-token' };
      request.user = { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarDataUri: null, role: 'admin' };
      request._fastifyParsedBody = JSON.stringify(body);
      return request;
    };
    const logoutResponse = new MockResponse();
    const linksResponse = new MockResponse();
    const unlinkResponse = new MockResponse();
    const passwordResponse = new MockResponse();
    const profileResponse = new MockResponse();

    await routes.handle(authenticatedRequest({}, '/api/v1/auth/logout'), logoutResponse as unknown as http.ServerResponse, '/api/v1/auth/logout', 'POST', container);
    await routes.handle(authenticatedRequest({}, '/api/v1/auth/sso/links'), linksResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/links', 'GET', container);
    await routes.handle(authenticatedRequest({}, '/api/v1/auth/sso/links/directory-1'), unlinkResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/links/directory-1', 'DELETE', container);
    await routes.handle(authenticatedRequest({ currentPassword: 'old-password', newPassword: 'new-password' }, '/api/v1/auth/change-password'), passwordResponse as unknown as http.ServerResponse, '/api/v1/auth/change-password', 'POST', container);
    await routes.handle(authenticatedRequest({ displayName: 'Owner' }, '/api/v1/auth/me'), profileResponse as unknown as http.ServerResponse, '/api/v1/auth/me', 'PATCH', container);

    expect(container.services.authService.logout).toHaveBeenCalledWith('session-token');
    expect(container.services.directorySsoService.listLinks).toHaveBeenCalledWith('owner-1');
    expect(container.services.directorySsoService.unlink).toHaveBeenCalledWith('directory-1', 'owner-1');
    expect(container.services.authService.changePassword).toHaveBeenCalledWith('owner-1', 'old-password', 'new-password');
    expect(container.services.userManagementService.updateProfile).toHaveBeenCalledWith('owner-1', 'Owner', null);
    expect(logoutResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(linksResponse.end).toHaveBeenCalledWith(expect.stringContaining('directory-1'));
    expect(unlinkResponse.end).toHaveBeenCalledWith(expect.stringContaining('"success":true'));
    expect(passwordResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(profileResponse.end).toHaveBeenCalledWith(expect.stringContaining('"displayName":"Owner"'));
  });

  it('Scenario: Given invalid password fields or an unknown protected route When requested Then validation returns the public contract', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const container = { guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } } } as unknown as BootstrapContainer;
    const request = createRequest();
    request.user = { id: 'owner-1', username: 'owner', displayName: null, avatarDataUri: null, role: 'admin' };
    request._fastifyParsedBody = JSON.stringify({ currentPassword: 'old', newPassword: 'short' });
    const validationResponse = new MockResponse();
    const missingResponse = new MockResponse();

    await routes.handle(request, validationResponse as unknown as http.ServerResponse, '/api/v1/auth/change-password', 'POST', container);
    await routes.handle(request, missingResponse as unknown as http.ServerResponse, '/api/v1/auth/unknown', 'GET', container);

    expect(validationResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(missingResponse.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('Scenario: Given incomplete or unrelated public requests When handled Then they are rejected without entering a protected flow', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const container = { guards: { authGuard: { protect: jest.fn() } } } as unknown as BootstrapContainer;
    const unrelatedResponse = new MockResponse();
    const missingCredentialsResponse = new MockResponse();
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ username: 'owner' });

    await expect(routes.handle(request, unrelatedResponse as unknown as http.ServerResponse, '/api/v1/devices', 'GET', container)).resolves.toBe(false);
    await routes.handle(request, missingCredentialsResponse as unknown as http.ServerResponse, '/api/v1/auth/login', 'POST', container);

    expect(container.guards.authGuard.protect).not.toHaveBeenCalled();
    expect(missingCredentialsResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(missingCredentialsResponse.end).toHaveBeenCalledWith(expect.stringContaining('Missing credentials'));
  });

  it('Scenario: Given authorization or validation failures in protected actions When requested Then the route preserves its error contracts', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      services: {
        directorySsoService: { unlink: jest.fn().mockResolvedValue(false) },
        authService: { changePassword: jest.fn().mockResolvedValue({ success: false }) },
      },
    } as unknown as BootstrapContainer;
    const authenticatedRequest = (body: unknown) => {
      const request = createRequest();
      request.user = { id: 'owner-1', username: 'owner', displayName: null, avatarDataUri: null, role: 'admin' };
      request._fastifyParsedBody = JSON.stringify(body);
      return request;
    };
    const unlinkResponse = new MockResponse();
    const changePasswordResponse = new MockResponse();

    await routes.handle(authenticatedRequest({}), unlinkResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/links/not-owned', 'DELETE', container);
    await routes.handle(authenticatedRequest({ currentPassword: 'old-password', newPassword: 'new-password' }), changePasswordResponse as unknown as http.ServerResponse, '/api/v1/auth/change-password', 'POST', container);

    expect(unlinkResponse.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(changePasswordResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
  });

  it('Scenario: Given a raw avatar upload When updating the profile Then the stored media path is returned with a cache buster', async () => {
    const saveUserAvatar = jest.fn().mockResolvedValue('/media/users/owner.png');
    const routes = new AuthRoutes({ saveUserAvatar } as unknown as MediaService, new LoginAttemptRateLimiter());
    const updatedUser = { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarDataUri: '/media/users/owner.png?v=1', role: 'admin', isActive: true };
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      services: { userManagementService: { updateProfile: jest.fn().mockResolvedValue(undefined) } },
      repositories: { userRepository: { findById: jest.fn().mockResolvedValue(updatedUser) } },
    } as unknown as BootstrapContainer;
    const request = createRequest();
    request.user = { id: 'owner-1', username: 'owner', displayName: null, avatarDataUri: null, role: 'admin' };
    request._fastifyParsedBody = JSON.stringify({ displayName: ' Owner ', avatarDataUri: 'data:image/png;base64,ZmFrZQ==' });
    const response = new MockResponse();

    await routes.handle(request, response as unknown as http.ServerResponse, '/api/v1/auth/me', 'PATCH', container);

    expect(saveUserAvatar).toHaveBeenCalledWith('owner', 'data:image/png;base64,ZmFrZQ==');
    expect(container.services.userManagementService.updateProfile).toHaveBeenCalledWith('owner-1', 'Owner', expect.stringMatching(/^\/media\/users\/owner\.png\?v=\d+$/));
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });
});
describe('Feature: authentication route resilience contracts', () => {
  it('Scenario: Given a missing or invalid directory SSO token When the public endpoint is called Then it returns the stable public error contract', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const missingTokenRequest = createRequest();
    missingTokenRequest._fastifyParsedBody = JSON.stringify({});
    const missingTokenResponse = new MockResponse();
    const invalidTokenRequest = createRequest();
    invalidTokenRequest._fastifyParsedBody = JSON.stringify({ token: 'invalid-token' });
    const invalidTokenResponse = new MockResponse();
    const container = {
      services: {
        directorySsoService: {
          login: jest.fn().mockRejectedValue(new DirectorySsoError('SSO_TOKEN_INVALID')),
        },
      },
    } as unknown as BootstrapContainer;

    await routes.handle(missingTokenRequest, missingTokenResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container);
    await routes.handle(invalidTokenRequest, invalidTokenResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container);

    expect(missingTokenResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(missingTokenResponse.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
    expect(invalidTokenResponse.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(invalidTokenResponse.end).toHaveBeenCalledWith(expect.stringContaining('SSO_TOKEN_INVALID'));
  });

  it('Scenario: Given unexpected protected-operation failures When changing password or updating profile Then internal errors are returned without leaking a partial success', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const container = {
      guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
      services: {
        authService: { changePassword: jest.fn().mockRejectedValue(new Error('credential store unavailable')) },
        userManagementService: { updateProfile: jest.fn().mockRejectedValue(new Error('profile store unavailable')) },
      },
    } as unknown as BootstrapContainer;
    const authenticatedRequest = (body: unknown) => {
      const request = createRequest();
      request.user = { id: 'owner-1', username: 'owner', displayName: null, avatarDataUri: null, role: 'admin' };
      request._fastifyParsedBody = JSON.stringify(body);
      return request;
    };
    const passwordResponse = new MockResponse();
    const profileResponse = new MockResponse();

    await routes.handle(authenticatedRequest({ currentPassword: 'old-password', newPassword: 'new-password' }), passwordResponse as unknown as http.ServerResponse, '/api/v1/auth/change-password', 'POST', container);
    await routes.handle(authenticatedRequest({ displayName: 'Owner' }), profileResponse as unknown as http.ServerResponse, '/api/v1/auth/me', 'PATCH', container);

    expect(passwordResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(passwordResponse.end).toHaveBeenCalledWith(expect.stringContaining('INTERNAL_ERROR'));
    expect(profileResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(profileResponse.end).toHaveBeenCalledWith(expect.stringContaining('profile store unavailable'));
  });
});
describe('Feature: directory SSO response contracts', () => {
  it('Scenario: Given an unlinked or linked directory token When it is exchanged Then only linked identities receive session material', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const unlinkedRequest = createRequest();
    unlinkedRequest._fastifyParsedBody = JSON.stringify({ token: 'unlinked-token' });
    const linkedRequest = createRequest();
    linkedRequest._fastifyParsedBody = JSON.stringify({ token: 'linked-token' });
    const unlinkedResponse = new MockResponse();
    const linkedResponse = new MockResponse();
    const directorySsoService = {
      login: jest.fn()
        .mockResolvedValueOnce({ linked: false })
        .mockResolvedValueOnce({
          linked: true,
          token: 'local-session',
          user: { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarDataUri: null, role: 'admin', isActive: true },
        }),
    };
    const container = { services: { directorySsoService } } as unknown as BootstrapContainer;

    await routes.handle(unlinkedRequest, unlinkedResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container);
    await routes.handle(linkedRequest, linkedResponse as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container);

    expect(unlinkedResponse.end).toHaveBeenCalledWith('{"linked":false}');
    expect(linkedResponse.end).toHaveBeenCalledWith(expect.stringContaining('"token":"local-session"'));
    expect(linkedResponse.end).toHaveBeenCalledWith(expect.stringContaining('"username":"owner"'));
  });

  it('Scenario: Given valid local credentials with an SSO link token When logging in Then it delegates the atomic link callback and returns the normal session contract', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ username: 'Owner ', password: 'valid-password', ssoLinkToken: 'directory-link-token' });
    const response = new MockResponse();
    const linkAfterLocalLogin = jest.fn().mockResolvedValue(undefined);
    const login = jest.fn().mockImplementation(async (_username, _password, afterLogin) => {
      await afterLogin({ id: 'owner-1' });
      return {
        token: 'session-token',
        user: { id: 'owner-1', username: 'owner', displayName: 'Owner', avatarDataUri: null, role: 'admin', isActive: true },
      };
    });
    const container = {
      services: { authService: { login }, directorySsoService: { linkAfterLocalLogin } },
      repositories: { activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) } },
    } as unknown as BootstrapContainer;

    await routes.handle(request, response as unknown as http.ServerResponse, '/api/v1/auth/login', 'POST', container);

    expect(login).toHaveBeenCalledWith('Owner ', 'valid-password', expect.any(Function));
    expect(linkAfterLocalLogin).toHaveBeenCalledWith('directory-link-token', 'owner-1');
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"token":"session-token"'));
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
  it('Scenario: Given a directory service configuration failure When exchanging a token Then the endpoint returns the SSO-specific unavailable contract', async () => {
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const request = createRequest();
    request._fastifyParsedBody = JSON.stringify({ token: 'configured-token' });
    const response = new MockResponse();
    const container = {
      services: { directorySsoService: { login: jest.fn().mockRejectedValue(new DirectorySsoError('SSO_NOT_CONFIGURED')) } },
    } as unknown as BootstrapContainer;

    await routes.handle(request, response as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('SSO_NOT_CONFIGURED'));
  });
});