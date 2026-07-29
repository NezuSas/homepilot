import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { LoginAttemptRateLimiter } from '../../../packages/auth/application/LoginAttemptRateLimiter';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { AuthRoutes } from '../routes/AuthRoutes';

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

describe('AuthRoutes security controls', () => {
  it('returns 429 with Retry-After while a login key is locked', async () => {
    const limiter = new LoginAttemptRateLimiter({ maxFailures: 1, lockoutMs: 60_000 });
    const routes = new AuthRoutes(limiter);
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
});
