import Database from 'better-sqlite3';
import { SqliteSessionRepository } from './SqliteSessionRepository';

describe('Feature: expired sessions do not accumulate', () => {
  let database: Database.Database;
  let repository: SqliteSessionRepository;
  const hours = (amount: number) => new Date(Date.now() + amount * 3_600_000).toISOString();

  beforeEach(() => {
    database = new Database(':memory:');
    database.exec('CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)');
    repository = new SqliteSessionRepository(database);
  });

  afterEach(() => database.close());

  const create = (token: string, expiresAt: string) => repository.createSession({ id: token, token, userId: 'u1', expiresAt, createdAt: hours(-100) } as never);
  const tokens = () => (database.prepare('SELECT token FROM sessions ORDER BY token').all() as Array<{ token: string }>).map((row) => row.token);

  it('Scenario: Given sessions expired more than a day ago When a new session starts Then only those are removed', async () => {
    await create('long-gone', hours(-72));
    await create('yesterday-ish', hours(-30));
    await create('just-expired', hours(-2));
    await create('active', hours(12));

    await create('new-login', hours(24));

    expect(tokens()).toEqual(['active', 'just-expired', 'new-login']);
  });

  it('Scenario: Given only active sessions When a new session starts Then nothing is removed', async () => {
    await create('a', hours(5));
    await create('b', hours(6));

    await create('c', hours(7));

    expect(tokens()).toEqual(['a', 'b', 'c']);
  });
});
