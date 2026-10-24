import Database from 'better-sqlite3';
import { PreparedStatementCache } from '../PreparedStatementCache';

describe('PreparedStatementCache', () => {
  const withDatabase = (run: (db: Database.Database) => void): void => {
    const db = new Database(':memory:');
    try {
      db.exec('CREATE TABLE things (id TEXT PRIMARY KEY, name TEXT)');
      run(db);
    } finally {
      db.close();
    }
  };

  it('compiles each statement once and keeps it usable', () => {
    withDatabase((db) => {
      const prepare = jest.spyOn(db, 'prepare');
      const cache = new PreparedStatementCache(db);
      const sql = 'SELECT name FROM things WHERE id = ?';

      db.prepare('INSERT INTO things (id, name) VALUES (?, ?)').run('a', 'lámpara');
      prepare.mockClear();

      const first = cache.get(sql).get('a') as { name: string } | undefined;
      const second = cache.get(sql).get('a') as { name: string } | undefined;
      const third = cache.get(sql).get('a') as { name: string } | undefined;

      expect([first?.name, second?.name, third?.name]).toEqual(['lámpara', 'lámpara', 'lámpara']);
      expect(prepare).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps one statement per distinct SQL', () => {
    withDatabase((db) => {
      const prepare = jest.spyOn(db, 'prepare');
      const cache = new PreparedStatementCache(db);

      cache.get('SELECT count(*) AS total FROM things');
      cache.get('SELECT id FROM things');
      cache.get('SELECT count(*) AS total FROM things');

      expect(prepare).toHaveBeenCalledTimes(2);
    });
  });

  it('reflects rows written after the statement was cached', () => {
    withDatabase((db) => {
      const cache = new PreparedStatementCache(db);
      const read = () => (cache.get('SELECT count(*) AS total FROM things').get() as { total: number }).total;

      expect(read()).toBe(0);
      cache.get('INSERT INTO things (id, name) VALUES (?, ?)').run('b', 'cortina');
      // A reused statement must not serve a stale result.
      expect(read()).toBe(1);
    });
  });
});
