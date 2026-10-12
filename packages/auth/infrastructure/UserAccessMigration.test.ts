import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SqliteUserRepository } from './SqliteUserRepository';

const migration = (file: string) => readFileSync(join(process.cwd(), 'migrations', file), 'utf8');

/** A database as it was before household access existed: users from migrations 003 and 016, plus the rooms table. */
function legacyDatabase() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(migration('003_add_auth_tables.sql'));
  db.exec(migration('016_add_user_profile_fields.sql'));
  db.exec('CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL)');
  db.prepare("INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ('u-guest', 'visita', 'h', 'guest', 1, 'now', 'now')").run();
  db.prepare("INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ('u-admin', 'admin', 'h', 'admin', 1, 'now', 'now')").run();
  return db;
}

describe('Feature: migration 036 gives existing users the whole home and no expiry', () => {
  it('Scenario: Given users created before the migration When it runs Then they keep the whole home and never expire', async () => {
    const db = legacyDatabase();

    db.exec(migration('036_user_access_scope.sql'));

    const users = await new SqliteUserRepository(db).findAll();
    expect(users.map((user) => [user.username, user.accessScope, user.roomIds, user.expiresAt])).toEqual([
      ['visita', 'all', [], null],
      ['admin', 'all', [], null],
    ]);
  });

  it('Scenario: Given the migration ran When a scope outside all or rooms is stored Then the database refuses it', () => {
    const db = legacyDatabase();
    db.exec(migration('036_user_access_scope.sql'));

    expect(() => db.prepare("UPDATE users SET access_scope = 'everything' WHERE id = 'u-guest'").run()).toThrow();
  });

  it('Scenario: Given rooms linked to a guest When a room or the guest is deleted Then the links disappear with them', async () => {
    const db = legacyDatabase();
    db.exec(migration('036_user_access_scope.sql'));
    db.prepare("INSERT INTO rooms (id, name) VALUES ('sala', 'Sala'), ('cocina', 'Cocina')").run();
    const repository = new SqliteUserRepository(db);
    await repository.updateAccess('u-guest', 'rooms', ['sala', 'cocina'], '2099-01-01T00:00:00.000Z');
    expect((await repository.findById('u-guest'))?.roomIds).toEqual(['cocina', 'sala']);

    db.prepare("DELETE FROM rooms WHERE id = 'cocina'").run();
    expect((await repository.findById('u-guest'))?.roomIds).toEqual(['sala']);

    db.prepare("DELETE FROM users WHERE id = 'u-guest'").run();
    expect(db.prepare('SELECT count(*) AS count FROM user_room_access').get()).toEqual({ count: 0 });
  });

  it('Scenario: Given new rooms are saved again When the same room repeats Then it is stored once and the scope is replaced, not appended', async () => {
    const db = legacyDatabase();
    db.exec(migration('036_user_access_scope.sql'));
    db.prepare("INSERT INTO rooms (id, name) VALUES ('sala', 'Sala'), ('cocina', 'Cocina')").run();
    const repository = new SqliteUserRepository(db);

    await repository.updateAccess('u-guest', 'rooms', ['sala', 'sala'], null);
    await repository.updateAccess('u-guest', 'rooms', ['cocina'], null);

    expect((await repository.findById('u-guest'))?.roomIds).toEqual(['cocina']);
  });
});

describe('Feature: migration 038 retires the operator role', () => {
  it('Scenario: Given an operator account and other users When the migration runs Then only the operator becomes a family member', async () => {
    const db = legacyDatabase();
    db.prepare("INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ('u-op', 'tecnico', 'h', 'operator', 1, 'now', 'now')").run();
    db.exec(migration('036_user_access_scope.sql'));

    db.exec(migration('038_retire_operator_role.sql'));

    const roles = Object.fromEntries((await new SqliteUserRepository(db).findAll()).map((user) => [user.username, user.role]));
    expect(roles).toEqual({ visita: 'guest', admin: 'admin', tecnico: 'parent' });
  });

  it('Scenario: Given no operator accounts When the migration runs Then nothing changes', () => {
    const db = legacyDatabase();

    db.exec(migration('038_retire_operator_role.sql'));

    expect(db.prepare('SELECT count(*) AS count FROM users WHERE role = ?').get('operator')).toEqual({ count: 0 });
    expect(db.prepare('SELECT count(*) AS count FROM users').get()).toEqual({ count: 2 });
  });
});
