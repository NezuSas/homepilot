import { generateKeyPairSync, sign } from 'node:crypto';
import { DirectorySsoError, DirectorySsoVerifier } from './DirectorySsoVerifier';
import { DirectorySsoService } from './DirectorySsoService';
import type { DirectoryAccountLink, DirectoryLinkRepository, UsedSsoTokenRepository } from './ports/DirectorySsoPorts';

const keys = generateKeyPairSync('ed25519');
const publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = () => Math.floor(Date.now() / 1000);
const token = (overrides: Partial<Record<string, unknown>> = {}) => {
  const payload = { directoryAccountId: 'directory-account', homeId: 'home-1', iat: now(), exp: now() + 60, jti: crypto.randomUUID(), ...overrides };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${sign(null, Buffer.from(encoded), keys.privateKey).toString('base64url')}`;
};

class MemorySsoRepository implements DirectoryLinkRepository, UsedSsoTokenRepository {
  readonly links = new Map<string, DirectoryAccountLink>();
  readonly used = new Set<string>();
  async findByDirectoryAccountId(id: string) { return this.links.get(id) ?? null; }
  async create(id: string, userId: string) { this.links.set(id, { directoryAccountId: id, localUserId: userId, createdAt: '', lastUsedAt: '' }); }
  async delete(id: string, userId: string) { const link = this.links.get(id); if (!link || link.localUserId !== userId) return false; this.links.delete(id); return true; }
  async listByLocalUserId(userId: string) { return [...this.links.values()].filter((link) => link.localUserId === userId); }
  async linkAndConsume(id: string, userId: string, jti: string) { await this.create(id, userId); this.used.add(jti); }
  async isUsed(jti: string) { return this.used.has(jti); }
  async markUsed(jti: string) { this.used.add(jti); }
  async purgeExpired() {}
}

const auth = (role = 'admin') => ({ createSessionForUserId: jest.fn(async (id: string) => ({ token: 'session', user: { id, username: 'oscar', role, isActive: true, displayName: null, avatarDataUri: null, passwordHash: '', createdAt: '', updatedAt: '' } })) });

describe('Directory SSO AC1-AC8', () => {
  it('AC1/AC2 links a first access after local login and creates a normal local session afterwards', async () => {
    const repo = new MemorySsoRepository(); const service = new DirectorySsoService(new DirectorySsoVerifier(repo, publicKey), repo, auth() as never);
    const first = token(); await service.linkAfterLocalLogin(first, 'local-user');
    const result = await service.login(token({ directoryAccountId: 'directory-account' }));
    expect(result).toMatchObject({ linked: true, token: 'session', user: { id: 'local-user' } });
  });

  it('AC3/AC4 rejects replayed, expired and invalid signatures without creating a session', async () => {
    const repo = new MemorySsoRepository(); const service = new DirectorySsoService(new DirectorySsoVerifier(repo, publicKey), repo, auth() as never);
    const replay = token(); await expect(service.login(replay)).resolves.toEqual({ linked: false });
    await expect(service.login(replay)).rejects.toMatchObject({ code: 'SSO_TOKEN_REPLAYED' });
    await expect(service.login(token({ exp: now() - 1 }))).rejects.toMatchObject({ code: 'SSO_TOKEN_EXPIRED' });
    await expect(service.login(`${token()}.tampered`)).rejects.toBeInstanceOf(DirectorySsoError);
  });

  it('AC5/AC6 lists and unlinks only links owned by the current local user', async () => {
    const repo = new MemorySsoRepository(); await repo.create('one', 'owner'); await repo.create('two', 'other');
    const service = new DirectorySsoService(new DirectorySsoVerifier(repo, publicKey), repo, auth() as never);
    expect(await service.listLinks('owner')).toHaveLength(1);
    expect(await service.unlink('two', 'owner')).toBe(false);
    expect(await service.unlink('one', 'owner')).toBe(true);
  });

  it('maps a SQLite consume constraint to the stable replay error before a session is created', async () => {
    const payload = { directoryAccountId: 'directory-account', homeId: 'home-1', exp: now() + 60, jti: 'already-used' };
    const verifier = {
      verify: jest.fn().mockResolvedValue(payload),
      consume: jest.fn().mockRejectedValue(Object.assign(new Error('UNIQUE constraint failed: directory_sso_used_tokens.jti'), { code: 'SQLITE_CONSTRAINT' })),
    };
    const repo = new MemorySsoRepository();
    await repo.create('directory-account', 'local-user');
    const localAuth = auth();
    const service = new DirectorySsoService(verifier as never, repo, localAuth as never);

    await expect(service.login('valid-but-replayed-token')).rejects.toMatchObject({ code: 'SSO_TOKEN_REPLAYED' });
    expect(localAuth.createSessionForUserId).not.toHaveBeenCalled();
  });

  it('rejects a valid linked token when its linked local account no longer exists', async () => {
    const repo = new MemorySsoRepository();
    await repo.create('directory-account', 'deleted-local-user');
    const localAuth = { createSessionForUserId: jest.fn().mockResolvedValue(null) };
    const service = new DirectorySsoService(new DirectorySsoVerifier(repo, publicKey), repo, localAuth as never);

    await expect(service.login(token())).rejects.toMatchObject({ code: 'SSO_TOKEN_INVALID' });
  });

  it('maps atomic link-and-consume uniqueness failures to the stable replay error', async () => {
    const payload = { directoryAccountId: 'directory-account', homeId: 'home-1', exp: now() + 60, jti: 'already-used' };
    const verifier = { verify: jest.fn().mockResolvedValue(payload) };
    const repo = new MemorySsoRepository();
    repo.linkAndConsume = jest.fn().mockRejectedValue(new Error('UNIQUE constraint failed: directory_sso_used_tokens.jti'));
    const service = new DirectorySsoService(verifier as never, repo, auth() as never);

    await expect(service.linkAfterLocalLogin('valid-but-replayed-token', 'local-user')).rejects.toMatchObject({ code: 'SSO_TOKEN_REPLAYED' });
  });

  it('AC7/AC8 preserves the local role and does not require the Directory after a local session is issued', async () => {
    const repo = new MemorySsoRepository(); await repo.create('directory-account', 'operator-user');
    const localAuth = auth('operator'); const service = new DirectorySsoService(new DirectorySsoVerifier(repo, publicKey), repo, localAuth as never);
    const result = await service.login(token());
    expect(result).toMatchObject({ linked: true, user: { role: 'operator' } });
    expect(localAuth.createSessionForUserId).toHaveBeenCalledWith('operator-user');
  });
});
describe('DirectorySsoVerifier structural security contracts', () => {
  it('Scenario: Given an installation without a Directory public key When a token is presented Then verification remains unavailable', async () => {
    const verifier = new DirectorySsoVerifier(new MemorySsoRepository(), '');

    await expect(verifier.verify(token())).rejects.toMatchObject({ code: 'SSO_NOT_CONFIGURED' });
  });

  it('Scenario: Given a correctly signed token with missing mandatory claims When it is verified Then it is rejected as invalid before use', async () => {
    const verifier = new DirectorySsoVerifier(new MemorySsoRepository(), publicKey);

    await expect(verifier.verify(token({ jti: undefined }))).rejects.toMatchObject({ code: 'SSO_TOKEN_INVALID' });
    await expect(verifier.verify(token({ iat: 'not-an-epoch' }))).rejects.toMatchObject({ code: 'SSO_TOKEN_INVALID' });
  });

  it('Scenario: Given an Edge bound to a Directory home When a signed token for another home is presented Then it is rejected before replay state is changed', async () => {
    const repository = new MemorySsoRepository();
    const verifier = new DirectorySsoVerifier(repository, publicKey, { homeId: 'home-oscar' });

    await expect(verifier.verify(token({ homeId: 'home-other' }))).rejects.toMatchObject({ code: 'SSO_TOKEN_HOME_MISMATCH' });
    expect(repository.used.size).toBe(0);
  });

  it('Scenario: Given an Edge bound to a Directory home When a signed token for that home is presented Then it remains valid for the existing SSO flow', async () => {
    const verifier = new DirectorySsoVerifier(new MemorySsoRepository(), publicKey, { homeId: 'home-oscar' });

    await expect(verifier.verify(token({ homeId: 'home-oscar' }))).resolves.toMatchObject({ homeId: 'home-oscar' });
  });
});