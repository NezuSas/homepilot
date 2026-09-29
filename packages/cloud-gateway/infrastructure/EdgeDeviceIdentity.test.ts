import { verify } from 'node:crypto';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
import { EdgeDeviceIdentityService } from '../application/EdgeDeviceIdentityService';
import { DirectoryEdgeServiceTokenClient, canonicalDeviceProofPayload, directoryEdgeDeviceUrl } from './DirectoryEdgeServiceTokenClient';
import { SoftwareDeviceIdentityProvider } from './SoftwareDeviceIdentityProvider';
import { SqliteDeviceBindingRepository, type BoundDeviceIdentity } from './SqliteDeviceBindingRepository';
import { ecdsaDerToP1363 } from './Tpm2DeviceIdentityProvider';
import { createDeviceIdentityDiagnosticServer } from '../../../apps/api/DeviceIdentityDiagnosticServer';
import { sign as cryptoSign, generateKeyPairSync } from 'node:crypto';

const config = { url: 'wss://accounts.example.test/gateway/edge', token: 'edge-secret-never-log', homeId: 'home-1', edgeId: 'edge-1' };
const challengeId = 'e974d0f6-60b2-4ed0-b759-f8713156d37f';
const nonce = Buffer.alloc(32, 7).toString('base64url');
const response = (status: number, payload: unknown) => ({ status, ok: status >= 200 && status < 300, json: async () => payload }) as Response;

function database(): Database.Database {
  const db = new Database(':memory:');
  db.exec(readFileSync(join(process.cwd(), 'migrations', '031_create_edge_device_identity_binding.sql'), 'utf8'));
  return db;
}

async function boundFixture() {
  const db = database();
  const store = new SqliteDeviceBindingRepository(db);
  const provider = new SoftwareDeviceIdentityProvider();
  await provider.ensureIdentity();
  const binding: BoundDeviceIdentity = { bindingState: 'bound', homeId: config.homeId, edgeId: config.edgeId,
    keyId: await provider.getKeyId(), publicKey: await provider.getPublicKey(), algorithm: 'ES256',
    boundAt: new Date().toISOString() };
  store.bind(binding);
  const service = new EdgeDeviceIdentityService(store, provider, () => config);
  return { db, store, provider, binding, service };
}

describe('Edge device identity, local binding and Directory proof', () => {
  it('persists only public binding metadata and never downgrades an existing bound row', async () => {
    const { db, store, provider, binding } = await boundFixture();
    expect(store.get()).toEqual(binding);
    expect(JSON.stringify(store.get())).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(store.get())).not.toContain(config.token);
    expect(JSON.stringify(provider)).not.toContain('PRIVATE KEY');
    expect(() => store.bind(binding)).toThrow('DEVICE_ALREADY_BOUND');
    db.close();
  });

  it('keeps a historical unbound Edge on the original token request without TPM or challenge', async () => {
    const db = database();
    const service = new EdgeDeviceIdentityService(new SqliteDeviceBindingRepository(db), new SoftwareDeviceIdentityProvider(), () => config);
    expect(await service.verifyAtStartup()).toEqual({ status: 'READY' });
    const http = jest.fn().mockResolvedValue(response(200, { token: 'legacy-token' }));
    await expect(new DirectoryEdgeServiceTokenClient(() => config, http, service).requestToken()).resolves.toBe('legacy-token');
    expect(http).toHaveBeenCalledTimes(1);
    expect(http.mock.calls[0][0]).toContain('/directory/edge-service-token');
    expect(http.mock.calls[0][1].body).toBeUndefined();
    db.close();
  });

  it('enrolls explicitly and persists the bound identity only after Directory accepts it', async () => {
    const db = database();
    const store = new SqliteDeviceBindingRepository(db);
    const provider = new SoftwareDeviceIdentityProvider();
    const http = jest.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { keyId: string; publicKey: string; algorithm: string };
      expect(body).toEqual({ keyId: await provider.getKeyId(), publicKey: await provider.getPublicKey(), algorithm: 'ES256' });
      return response(201, { edgeId: config.edgeId, keyId: body.keyId, algorithm: 'ES256', boundAt: '2026-09-29T00:00:00.000Z' });
    });
    const service = new EdgeDeviceIdentityService(store, provider, () => config, http);
    await expect(service.enroll()).resolves.toMatchObject({ bindingState: 'bound', edgeId: config.edgeId });
    expect(http.mock.calls[0][0]).toBe(directoryEdgeDeviceUrl(config.url, 'enroll'));
    expect(store.get()?.publicKey).toBe(await provider.getPublicKey());
    await expect(service.enroll()).rejects.toThrow('DEVICE_ALREADY_BOUND');
    expect(http).toHaveBeenCalledTimes(1);
    db.close();
  });

  it('does not persist or replace a binding when Directory reports an existing device', async () => {
    const db = database();
    const store = new SqliteDeviceBindingRepository(db);
    const provider = new SoftwareDeviceIdentityProvider();
    const http = jest.fn().mockResolvedValue(response(409, { error: 'DEVICE_ALREADY_BOUND' }));
    const service = new EdgeDeviceIdentityService(store, provider, () => config, http);
    await expect(service.enroll()).rejects.toThrow('DEVICE_ALREADY_BOUND');
    expect(store.get()).toBeNull();
    expect(http).toHaveBeenCalledTimes(1);
    db.close();
  });

  it.each(['homepilot.manifest.read', 'homepilot.command.execute'] as const)('signs exact canonical %s proof and receives the unchanged service token', async (scope) => {
    const { db, service, provider, binding } = await boundFixture();
    expect(await service.verifyAtStartup()).toEqual({ status: 'READY' });
    const http = jest.fn().mockResolvedValueOnce(response(200, { challengeId, nonce, scope, expiresIn: 60 }))
      .mockResolvedValueOnce(response(200, { token: 'service-token', expiresIn: 120 }));
    const client = new DirectoryEdgeServiceTokenClient(() => config, http, service);
    if (scope === 'homepilot.manifest.read') await expect(client.requestToken()).resolves.toBe('service-token');
    else await expect(client.requestCommandToken()).resolves.toEqual({ token: 'service-token', expiresIn: 120 });
    expect(http.mock.calls[0][0]).toBe(directoryEdgeDeviceUrl(config.url, 'challenge'));
    expect(JSON.parse(http.mock.calls[0][1].body)).toEqual({ scope });
    const proofBody = JSON.parse(http.mock.calls[1][1].body) as { scope: string; deviceProof: { challengeId: string; keyId: string; signature: string } };
    expect(proofBody.scope).toBe(scope);
    expect(proofBody.deviceProof.keyId).toBe(binding.keyId);
    expect(proofBody.deviceProof.challengeId).toBe(challengeId);
    const expected = Buffer.from(`homepilot.edge-device-proof.v1\n${config.homeId}\n${config.edgeId}\n${challengeId}\n${nonce}\n${scope}\n`);
    expect(canonicalDeviceProofPayload({ homeId: config.homeId, edgeId: config.edgeId, challengeId, nonce, scope })).toEqual(expected);
    const signature = Buffer.from(proofBody.deviceProof.signature, 'base64url');
    expect(signature).toHaveLength(64);
    expect(verify('sha256', expected, { key: await provider.getPublicKey(), dsaEncoding: 'ieee-p1363' }, signature)).toBe(true);
    expect(JSON.stringify(http.mock.calls)).not.toContain('PRIVATE KEY');
    db.close();
  });

  it('returns a safe error for Directory proof rejection and never falls back to legacy', async () => {
    const { db, service } = await boundFixture();
    await service.verifyAtStartup();
    const http = jest.fn().mockResolvedValueOnce(response(200, { challengeId, nonce, scope: 'homepilot.manifest.read', expiresIn: 60 }))
      .mockResolvedValueOnce(response(403, { error: 'DEVICE_PROOF_INVALID' }));
    const failure = await new DirectoryEdgeServiceTokenClient(() => config, http, service).requestToken().catch((error: unknown) => error);
    expect(failure).toMatchObject({ code: 'INTENTFLOW_DIRECTORY_REJECTED' });
    expect(http).toHaveBeenCalledTimes(2);
    expect(String(failure)).not.toContain(config.token);
    db.close();
  });

  it('fails closed for missing or different TPM identity after copying bound data to another MiniPC', async () => {
    const { db, store, service } = await boundFixture();
    expect(await service.verifyAtStartup()).toEqual({ status: 'READY' });
    const absent = new EdgeDeviceIdentityService(store, new SoftwareDeviceIdentityProvider(), () => config);
    expect(await absent.verifyAtStartup()).toEqual({ status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID' });
    const wrongProvider = new SoftwareDeviceIdentityProvider();
    await wrongProvider.ensureIdentity();
    const clone = new EdgeDeviceIdentityService(store, wrongProvider, () => config);
    expect(await clone.verifyAtStartup()).toEqual({ status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID' });
    const http = jest.fn();
    await expect(new DirectoryEdgeServiceTokenClient(() => config, http, clone).requestToken())
      .rejects.toMatchObject({ code: 'DEVICE_IDENTITY_INVALID' });
    expect(http).not.toHaveBeenCalled();
    db.close();
  });

  it('reloads an existing development identity for a bound restart without generating a replacement key', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'homepilot-identity-test-'));
    const db = database();
    try {
      const keyPath = join(directory, 'software-key.pem');
      const original = new SoftwareDeviceIdentityProvider(keyPath);
      await original.ensureIdentity();
      const store = new SqliteDeviceBindingRepository(db);
      store.bind({ bindingState: 'bound', homeId: config.homeId, edgeId: config.edgeId,
        keyId: await original.getKeyId(), publicKey: await original.getPublicKey(), algorithm: 'ES256',
        boundAt: '2026-09-29T00:00:00.000Z' });
      const restarted = new EdgeDeviceIdentityService(store, new SoftwareDeviceIdentityProvider(keyPath), () => config);
      expect(await restarted.verifyAtStartup()).toEqual({ status: 'READY' });
      const missing = new EdgeDeviceIdentityService(store,
        new SoftwareDeviceIdentityProvider(join(directory, 'missing-key.pem')), () => config);
      expect(await missing.verifyAtStartup()).toEqual({ status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID' });
    } finally {
      db.close();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps local readiness when Directory is offline and identity is valid', async () => {
    const { db, service } = await boundFixture();
    expect(await service.verifyAtStartup()).toEqual({ status: 'READY' });
    const http = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(new DirectoryEdgeServiceTokenClient(() => config, http, service).requestToken())
      .rejects.toMatchObject({ code: 'INTENTFLOW_DIRECTORY_UNAVAILABLE' });
    expect(service.getReadiness()).toEqual({ status: 'READY' });
    db.close();
  });

  it('converts TPM ECDSA DER to a valid 64-byte P1363 signature without hardware', () => {
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const message = Buffer.from('sample');
    const der = cryptoSign('sha256', message, { key: pair.privateKey, dsaEncoding: 'der' });
    const p1363 = ecdsaDerToP1363(der);
    expect(p1363).toHaveLength(64);
    expect(verify('sha256', message, { key: pair.publicKey, dsaEncoding: 'ieee-p1363' }, p1363)).toBe(true);
  });

  it('exposes diagnostic-only NOT READY without cryptographic details', async () => {
    const server = createDeviceIdentityDiagnosticServer().listen(0, '127.0.0.1');
    try {
      await once(server, 'listening');
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('No port');
      const result = await fetch(`http://127.0.0.1:${address.port}/health`);
      expect(result.status).toBe(503);
      expect(await result.json()).toEqual({ status: 'NOT_READY', code: 'DEVICE_IDENTITY_INVALID',
        message: 'HomePilot no está activado para este dispositivo. Contacta con NEZU.' });
    } finally { server.close(); }
  });
});
