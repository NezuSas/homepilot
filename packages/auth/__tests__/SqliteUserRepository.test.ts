import { Database } from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SqliteUserRepository } from '../infrastructure/SqliteUserRepository';
import { SqliteMigrationsRunner } from '../../shared/infrastructure/database/SqliteMigrationsRunner';
import { SqliteDatabaseManager } from '../../shared/infrastructure/database/SqliteDatabaseManager';
import { User } from '../domain/User';

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1', username: 'Oscar', passwordHash: 'hash-1', role: 'admin', isActive: true,
    displayName: 'Oscar', avatarDataUri: null, createdAt: '2026-08-17T10:00:00.000Z', updatedAt: '2026-08-17T10:00:00.000Z', ...overrides
  };
}

describe('SqliteUserRepository', () => {
  let dbPath: string;
  let db: Database;
  let repository: SqliteUserRepository;

  beforeAll(() => {
    dbPath = path.join(__dirname, `test-user-repository-${Date.now()}.db`);
    db = SqliteDatabaseManager.getInstance(dbPath);
    new SqliteMigrationsRunner(db).run(path.resolve(__dirname, '../../../migrations'));
    repository = new SqliteUserRepository(db);
  });
  afterEach(() => db.exec('DELETE FROM users'));
  afterAll(() => { db.close(); if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath); });

  it('seeds, counts, lists, and finds users by case-insensitive username and id', async () => {
    await repository.seedInitialAdmin(user());
    await repository.seedInitialAdmin(user({ id: 'user-2', username: 'Gustavo', role: 'parent', isActive: false, createdAt: '2026-08-17T11:00:00.000Z' }));
    await expect(repository.count()).resolves.toBe(2);
    await expect(repository.countActiveAdmins()).resolves.toBe(1);
    await expect(repository.findByUsername('oscar')).resolves.toEqual(expect.objectContaining({ id: 'user-1', displayName: 'Oscar' }));
    await expect(repository.findById('user-2')).resolves.toEqual(expect.objectContaining({ username: 'Gustavo', isActive: false }));
    await expect(repository.findByUsername('missing')).resolves.toBeNull();
    await expect(repository.findAll()).resolves.toEqual([expect.objectContaining({ id: 'user-1' }), expect.objectContaining({ id: 'user-2' })]);
  });

  it('updates credentials, role, activation, and profile properties', async () => {
    await repository.seedInitialAdmin(user());
    await repository.updatePassword('user-1', 'hash-2');
    await repository.updateRole('user-1', 'parent');
    await repository.updateActiveState('user-1', false);
    await repository.updateProfile('user-1', 'Updated Oscar', 'data:image/png;base64,abc');
    await expect(repository.findById('user-1')).resolves.toEqual(expect.objectContaining({ passwordHash: 'hash-2', role: 'parent', isActive: false, displayName: 'Updated Oscar', avatarDataUri: 'data:image/png;base64,abc' }));
  });

  it('protects the final active admin while allowing safe atomic changes', async () => {
    await repository.seedInitialAdmin(user());
    await repository.seedInitialAdmin(user({ id: 'user-2', username: 'Gustavo', role: 'admin', createdAt: '2026-08-17T11:00:00.000Z' }));
    await expect(repository.updateRoleAtomic('user-1', 'parent')).resolves.toBe(true);
    await expect(repository.findById('user-1')).resolves.toEqual(expect.objectContaining({ role: 'parent' }));
    await repository.updateRole('user-1', 'admin');
    await expect(repository.updateActiveStateAtomic('user-1', false)).resolves.toBe(true);
    await expect(repository.findById('user-1')).resolves.toEqual(expect.objectContaining({ isActive: false }));
    await repository.updateActiveState('user-1', true);
    await repository.updateRole('user-2', 'parent');
    await expect(repository.updateRoleAtomic('user-1', 'parent')).resolves.toBe(false);
    await expect(repository.updateActiveStateAtomic('user-1', false)).resolves.toBe(false);
  });

  it('allows atomic promotion and activation without the minimum-admin guard', async () => {
    await repository.seedInitialAdmin(user({ role: 'parent', isActive: false }));

    await expect(repository.updateRoleAtomic('user-1', 'admin')).resolves.toBe(true);
    await expect(repository.updateActiveStateAtomic('user-1', true)).resolves.toBe(true);
    await expect(repository.findById('user-1')).resolves.toEqual(expect.objectContaining({
      role: 'admin',
      isActive: true
    }));
  });
});