import { EventEmitter } from 'events';
import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import { InstallationVerificationBroker } from '../../../packages/cloud-gateway/application/InstallationVerificationBroker';
import { SystemRoutes } from '../routes/SystemRoutes';

const pathname = '/api/v1/system/installation-verification/attest';
const challenge = {
  installationId: '098ced36-2143-4ca2-a1fb-3afdc32117b7',
  challengeId: 'e974d0f6-60b2-4ed0-b759-f8713156d37f',
  nonce: Buffer.alloc(32, 7).toString('base64url'),
};
const config = { url: 'wss://accounts.example.test/gateway/edge', token: 'edge-secret', homeId: 'home-1', edgeId: 'edge-1' };
const proof = { attestation: 'cGF5bG9hZA.c2lnbmF0dXJl', expiresIn: 90 };

class MockResponse extends EventEmitter {
  readonly setHeader = jest.fn().mockReturnThis();
  readonly writeHead = jest.fn().mockReturnThis();
  readonly end = jest.fn().mockReturnThis();
}

function request(body: unknown): HomePilotRequest {
  const req = new EventEmitter() as HomePilotRequest;
  req.url = pathname;
  req.headers = { host: 'localhost' };
  req.socket = { remoteAddress: '127.0.0.1' } as HomePilotRequest['socket'];
  req.user = { id: 'admin-1', username: 'admin', role: 'admin', displayName: null, avatarDataUri: null };
  req._fastifyParsedBody = JSON.stringify(body);
  return req;
}

function container(authenticated = true, admin = true): { value: BootstrapContainer; fetchMock: jest.Mock } {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => proof });
  const value = {
    guards: { authGuard: {
      protect: jest.fn().mockResolvedValue(authenticated),
      requireRole: jest.fn().mockReturnValue(admin),
    } },
    services: {
      installationVerificationBroker: new InstallationVerificationBroker(() => config, fetchMock),
    },
  } as unknown as BootstrapContainer;
  return { value, fetchMock };
}

describe('Feature: local installation verification attestation route', () => {
  it('rejects unauthenticated callers before contacting Directory', async () => {
    const { value, fetchMock } = container(false);
    await new SystemRoutes().handle(request(challenge), new MockResponse() as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(value.guards.authGuard.protect).toHaveBeenCalledWith(expect.anything(), expect.anything(), true);
    expect(value.guards.authGuard.requireRole).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects authenticated non-admin callers before contacting Directory', async () => {
    const { value, fetchMock } = container(true, false);
    await new SystemRoutes().handle(request(challenge), new MockResponse() as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(value.guards.authGuard.requireRole).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'admin');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns only the proof to admins, with no-store and no cloud identity', async () => {
    const { value, fetchMock } = container();
    const res = new MockResponse();
    await new SystemRoutes().handle(request(challenge), res as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify(proof));
    const serialized = JSON.stringify(res.end.mock.calls);
    expect(serialized).not.toContain('edge-secret');
    expect(serialized).not.toContain('home-1');
    expect(serialized).not.toContain('edge-1');
  });

  it('rejects extra caller fields and malformed JSON without contacting Directory', async () => {
    const { value, fetchMock } = container();
    const extra = new MockResponse();
    await new SystemRoutes().handle(request({ ...challenge, directoryUrl: 'https://attacker.test', token: 'injected', homeId: 'injected' }), extra as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(extra.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
    expect(extra.end).toHaveBeenCalledWith(expect.stringContaining('INSTALLATION_VERIFICATION_INPUT_INVALID'));

    const malformed = request(challenge);
    malformed._fastifyParsedBody = '{bad-json';
    const invalidJson = new MockResponse();
    await new SystemRoutes().handle(malformed, invalidJson as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(invalidJson.end).toHaveBeenCalledWith(expect.stringContaining('INSTALLATION_VERIFICATION_INPUT_INVALID'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns sanitized stable errors, not Directory bodies or credentials', async () => {
    const { value, fetchMock } = container();
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const res = new MockResponse();
    await new SystemRoutes().handle(request(challenge), res as unknown as http.ServerResponse, pathname, 'POST', value);
    expect(res.writeHead).toHaveBeenCalledWith(502, { 'Content-Type': 'application/json' });
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('INSTALLATION_VERIFICATION_DIRECTORY_REJECTED'));
    expect(JSON.stringify(res.end.mock.calls)).not.toContain('edge-secret');
  });
});
