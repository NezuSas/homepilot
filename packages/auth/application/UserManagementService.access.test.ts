import Database from 'better-sqlite3';
import { AccountExpiredError, AuthService } from './AuthService';
import { UserManagementService } from './UserManagementService';
import { CryptoService } from '../infrastructure/CryptoService';
import { SqliteSessionRepository } from '../infrastructure/SqliteSessionRepository';
import { SqliteUserRepository } from '../infrastructure/SqliteUserRepository';
import type { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';

const FUTURE = () => new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

function createWorld(knownRooms: readonly string[] = ['sala', 'cocina']) {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1, display_name TEXT, avatar_data_uri TEXT,
      access_scope TEXT NOT NULL DEFAULT 'all' CHECK(access_scope IN ('all', 'rooms')), expires_at TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE user_room_access (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, room_id TEXT NOT NULL, PRIMARY KEY (user_id, room_id)
    );
  `);
  const users = new SqliteUserRepository(db);
  const sessions = new SqliteSessionRepository(db);
  const crypto = new CryptoService();
  const saveActivity = jest.fn().mockResolvedValue(undefined);
  const management = new UserManagementService(
    users, sessions, { saveActivity } as unknown as ActivityLogRepository, crypto,
    { findRoomById: async (id) => (knownRooms.includes(id) ? { id } : null) },
  );
  return { db, users, sessions, crypto, saveActivity, management, auth: new AuthService(users, sessions, crypto) };
}

describe('Feature: room access and expiry for household members', () => {
  it('Scenario: Given a guest created with rooms and an expiry When listed Then the access is stored and exposed', async () => {
    const { management } = createWorld();
    const expiresAt = FUTURE();

    const created = await management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest', accessScope: 'rooms', roomIds: ['sala', 'sala'], expiresAt });
    const listed = (await management.listUsers()).find((user) => user.id === created.id);

    expect(created).toMatchObject({ accessScope: 'rooms', roomIds: ['sala'], expiresAt });
    expect(listed).toMatchObject({ accessScope: 'rooms', roomIds: ['sala'], expiresAt });
  });

  it('Scenario: Given a user created the old way When listed Then it keeps the whole home and never expires', async () => {
    const { management } = createWorld();
    await management.createUser('admin-1', { username: 'ana', passwordPlain: 'longenough1', role: 'parent' });

    expect((await management.listUsers())[0]).toMatchObject({ accessScope: 'all', roomIds: [], expiresAt: null });
  });

  it.each([
    ['rooms for a family member', { role: 'parent' as const, accessScope: 'rooms' as const, roomIds: ['sala'] }, 'Only a child or a guest can be limited'],
    ['an unknown room', { role: 'guest' as const, accessScope: 'rooms' as const, roomIds: ['garage'] }, 'Unknown room'],
    ['an expiry on an administrator', { role: 'admin' as const, accessScope: 'all' as const, expiresAt: FUTURE() }, 'Only a child or a guest can expire'],
    ['an expiry in the past', { role: 'guest' as const, accessScope: 'all' as const, expiresAt: '2020-01-01T00:00:00.000Z' }, 'must be in the future'],
    ['an expiry that is not a date', { role: 'guest' as const, accessScope: 'all' as const, expiresAt: 'tomorrow-ish' }, 'must be a date'],
    ['an unknown scope', { role: 'guest' as const, accessScope: 'everything' as never }, 'accessScope must be'],
  ])('Scenario: Given %s When the user is created Then it is refused and nothing is stored', async (_name, input, reason) => {
    const { management, users } = createWorld();

    await expect(management.createUser('admin-1', { username: 'someone', passwordPlain: 'longenough1', ...input })).rejects.toThrow(reason);
    expect(await users.count()).toBe(0);
  });

  it('Scenario: Given an existing guest When the admin changes its access Then rooms, expiry and the audit entry follow', async () => {
    const { management, users, saveActivity } = createWorld();
    const guest = await management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest' });
    const expiresAt = FUTURE();

    await management.updateAccess('admin-1', guest.id, { accessScope: 'rooms', roomIds: ['cocina'], expiresAt });

    expect(await users.findById(guest.id)).toMatchObject({ accessScope: 'rooms', roomIds: ['cocina'], expiresAt });
    expect(saveActivity).toHaveBeenLastCalledWith(expect.objectContaining({
      type: 'USER_ACCESS_CHANGED',
      data: expect.objectContaining({ adminActorUserId: 'admin-1', targetUserId: guest.id, newAccessScope: 'rooms', roomCount: 1 }),
    }));

    await management.updateAccess('admin-1', guest.id, { accessScope: 'all', expiresAt: null });
    expect(await users.findById(guest.id)).toMatchObject({ accessScope: 'all', roomIds: [], expiresAt: null });
  });

  it('Scenario: Given a missing user or a restricted scope on a parent When access is updated Then it is refused', async () => {
    const { management } = createWorld();
    const parent = await management.createUser('admin-1', { username: 'ana', passwordPlain: 'longenough1', role: 'parent' });

    await expect(management.updateAccess('admin-1', 'nobody', { accessScope: 'all' })).rejects.toThrow('USER_NOT_FOUND');
    await expect(management.updateAccess('admin-1', parent.id, { accessScope: 'rooms', roomIds: ['sala'] })).rejects.toThrow('Only a child or a guest');
  });

  it('Scenario: Given a limited guest When promoted to parent Then the whole home is restored and the expiry cleared', async () => {
    const { management, users } = createWorld();
    const guest = await management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest', accessScope: 'rooms', roomIds: ['sala'], expiresAt: FUTURE() });

    await management.updateUserRole('admin-1', guest.id, 'parent');

    expect(await users.findById(guest.id)).toMatchObject({ role: 'parent', accessScope: 'all', roomIds: [], expiresAt: null });
  });

  it('Scenario: Given a room is deleted When the user is loaded Then the stale room link is gone with it', async () => {
    const { management, users, db } = createWorld();
    const guest = await management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest', accessScope: 'rooms', roomIds: ['sala', 'cocina'] });

    db.prepare('DELETE FROM user_room_access WHERE room_id = ?').run('cocina');

    expect((await users.findById(guest.id))?.roomIds).toEqual(['sala']);
  });
});

describe('Feature: a temporary account stops working when it expires', () => {
  async function guestWithExpiry(expiresAt: string) {
    const world = createWorld();
    const guest = await world.management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest' });
    world.db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run(expiresAt, guest.id);
    return { ...world, guest };
  }

  it('Scenario: Given a valid guest When it logs in before the expiry Then a session is issued', async () => {
    const { auth, management } = createWorld();
    const guest = await management.createUser('admin-1', { username: 'visita', passwordPlain: 'longenough1', role: 'guest', expiresAt: FUTURE() });

    const session = await auth.login('visita', 'longenough1');

    expect(session?.user.id).toBe(guest.id);
    expect(session?.user.expiresAt).not.toBeNull();
  });

  it('Scenario: Given an expired guest When it logs in with the right password Then the account is reported as expired', async () => {
    const { auth } = await guestWithExpiry('2020-01-01T00:00:00.000Z');

    await expect(auth.login('visita', 'longenough1')).rejects.toBeInstanceOf(AccountExpiredError);
  });

  it('Scenario: Given an expired guest When it logs in with a wrong password Then it looks like any failed login', async () => {
    const { auth } = await guestWithExpiry('2020-01-01T00:00:00.000Z');

    await expect(auth.login('visita', 'wrong-password')).resolves.toBeNull();
  });

  it('Scenario: Given an open session When the account expires Then the next request is refused and every session is revoked', async () => {
    const { auth, db, guest, sessions } = await guestWithExpiry(FUTURE());
    const session = await auth.login('visita', 'longenough1');
    const secondDevice = await auth.login('visita', 'longenough1');
    expect(session && (await auth.verifyToken(session.token)).isValid).toBe(true);

    db.prepare('UPDATE users SET expires_at = ? WHERE id = ?').run('2020-01-01T00:00:00.000Z', guest.id);

    expect(await auth.verifyToken(session!.token)).toMatchObject({ isValid: false, reason: 'account_expired' });
    expect(await sessions.getSessionByToken(secondDevice!.token)).toBeNull();
  });

  it('Scenario: Given an expired guest When a single sign-on session is requested Then none is created', async () => {
    const { auth, guest } = await guestWithExpiry('2020-01-01T00:00:00.000Z');

    await expect(auth.createSessionForUserId(guest.id)).resolves.toBeNull();
  });
});
