import { EventEmitter } from 'node:events';
import * as http from 'node:http';
import { generateKeyPairSync, sign } from 'node:crypto';
import Database from 'better-sqlite3';
import { AuthRoutes } from '../routes/AuthRoutes';
import { LoginAttemptRateLimiter } from '../../../packages/auth/application/LoginAttemptRateLimiter';
import { MediaService } from '../../../packages/shared/infrastructure/MediaService';
import { DirectorySsoService } from '../../../packages/auth/application/DirectorySsoService';
import { DirectorySsoVerifier } from '../../../packages/auth/application/DirectorySsoVerifier';
import { SqliteDirectorySsoRepository } from '../../../packages/auth/infrastructure/SqliteDirectorySsoRepository';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { BootstrapContainer } from '../../../bootstrap';

class MockResponse extends EventEmitter {
  readonly writeHead = jest.fn().mockReturnThis();
  readonly end = jest.fn().mockReturnThis();
  setHeader = jest.fn();
}

class BarrierSqliteDirectorySsoRepository extends SqliteDirectorySsoRepository {
  private arrivals = 0;
  private release!: () => void;
  private readonly barrier = new Promise<void>((resolve) => { this.release = resolve; });

  override async markUsed(jti: string, expiresAt: string): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals === 1) await this.barrier;
    else this.release();
    await super.markUsed(jti, expiresAt);
  }
}

const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();

function signToken(): string {
  const payload = Buffer.from(JSON.stringify({
    directoryAccountId: 'directory-account', homeId: 'home-1', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60, jti: 'single-use-token'
  })).toString('base64url');
  return `${payload}.${sign(null, Buffer.from(payload), keys.privateKey).toString('base64url')}`;
}

function request(token: string): HomePilotRequest {
  const req = new EventEmitter() as HomePilotRequest;
  req.headers = {};
  req.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  req._fastifyParsedBody = JSON.stringify({ token });
  return req;
}

describe('POST /api/v1/auth/sso/directory replay', () => {
  it('returns 401 SSO_TOKEN_REPLAYED when concurrent requests collide in SQLite', async () => {
    const db = new Database(':memory:');
    db.exec(`CREATE TABLE directory_account_links (directory_account_id TEXT PRIMARY KEY, local_user_id TEXT NOT NULL, created_at TEXT NOT NULL, last_used_at TEXT);
      CREATE TABLE directory_sso_used_tokens (jti TEXT PRIMARY KEY, used_at TEXT NOT NULL, expires_at TEXT NOT NULL);`);
    const repository = new BarrierSqliteDirectorySsoRepository(db);
    const service = new DirectorySsoService(
      new DirectorySsoVerifier(repository, publicKey), repository,
      { createSessionForUserId: jest.fn() } as never
    );
    const container = { services: { directorySsoService: service } } as unknown as BootstrapContainer;
    const routes = new AuthRoutes(new MediaService(), new LoginAttemptRateLimiter());
    const first = new MockResponse();
    const second = new MockResponse();

    await Promise.all([
      routes.handle(request(signToken()), first as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container),
      routes.handle(request(signToken()), second as unknown as http.ServerResponse, '/api/v1/auth/sso/directory', 'POST', container)
    ]);

    const bodies = [first, second].map((response) => JSON.parse(response.end.mock.calls[0][0]) as { error?: { code?: string } });
    const statuses = [first, second].map((response) => response.writeHead.mock.calls[0][0]);
    expect(statuses).toContain(200);
    expect(statuses).toContain(401);
    expect(bodies).toContainEqual(expect.objectContaining({ error: expect.objectContaining({ code: 'SSO_TOKEN_REPLAYED' }) }));
    db.close();
  });
});