import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { SqliteDatabaseManager } from '../SqliteDatabaseManager';

describe('Feature: SQLite journal compatibility', () => {
  const databasePath = path.resolve(__dirname, `sqlite-journal-${randomUUID()}.db`);
  const originalJournalMode = process.env.HOMEPILOT_SQLITE_JOURNAL_MODE;

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (originalJournalMode === undefined) {
      delete process.env.HOMEPILOT_SQLITE_JOURNAL_MODE;
    } else {
      process.env.HOMEPILOT_SQLITE_JOURNAL_MODE = originalJournalMode;
    }

    for (const filePath of [databasePath, `${databasePath}-wal`, `${databasePath}-shm`]) {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });

  it('Scenario: Given a Windows-compatible bind mount When DELETE journal mode is configured Then SQLite writes without WAL sidecar files', () => {
    process.env.HOMEPILOT_SQLITE_JOURNAL_MODE = 'DELETE';

    const database = SqliteDatabaseManager.getInstance(databasePath);
    database.exec('CREATE TABLE journal_probe (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    database.prepare('INSERT INTO journal_probe (value) VALUES (?)').run('persisted');

    expect(database.pragma('journal_mode', { simple: true })).toBe('delete');
    expect(database.prepare('SELECT value FROM journal_probe').get()).toEqual({ value: 'persisted' });
    expect(fs.existsSync(`${databasePath}-wal`)).toBe(false);
    expect(fs.existsSync(`${databasePath}-shm`)).toBe(false);
  });
});
