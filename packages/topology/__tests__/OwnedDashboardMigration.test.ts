import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const migration = fs.readFileSync(path.resolve(__dirname, '../../../migrations/032_owned_dashboards_and_default_tabs.sql'), 'utf8');

function database(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, display_name TEXT, created_at TEXT NOT NULL);
    CREATE TABLE dashboards (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, title TEXT NOT NULL,
      visibility TEXT NOT NULL, tabs TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `);
  return db;
}

const visibility = JSON.stringify({ roles: [], users: [], homes: [] });
const noDefaultTabs = JSON.stringify([{ id: 'tab-1', title: 'Principal', widgets: [] }]);

function insertDashboard(db: Database.Database, id: string, ownerId: string, tabs = noDefaultTabs): void {
  db.prepare('INSERT INTO dashboards VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, ownerId, id, visibility, tabs, '2026-01-01', '2026-01-01',
  );
}

describe('owned dashboard and default-tab migration', () => {
  it('preserves existing dashboards, backfills missing owners and reports legacy duplicates without deleting data', () => {
    const db = database();
    try {
      db.exec("INSERT INTO users VALUES ('one', 'oscar', 'Oscar', '2026-01-01'), ('missing', 'maria', 'María', '2026-01-01'), ('legacy', 'guest', NULL, '2026-01-01')");
      insertDashboard(db, 'original', 'one');
      insertDashboard(db, 'legacy-a', 'legacy');
      insertDashboard(db, 'legacy-b', 'legacy');

      db.exec(migration);

      const rows = db.prepare('SELECT id, owner_id, title FROM dashboards ORDER BY owner_id, id').all() as Array<{ id: string; owner_id: string; title: string }>;
      expect(rows.filter((row) => row.owner_id === 'one')).toEqual([{ id: 'original', owner_id: 'one', title: 'original' }]);
      expect(rows.filter((row) => row.owner_id === 'missing')).toEqual([expect.objectContaining({ title: 'María' })]);
      expect(rows.filter((row) => row.owner_id === 'legacy')).toHaveLength(2);
      expect(db.prepare('SELECT owner_id, dashboard_count FROM dashboard_owner_conflicts').all()).toEqual([
        { owner_id: 'legacy', dashboard_count: 2 },
      ]);
    } finally { db.close(); }
  });

  it('provisions a new user atomically with the initial display name and never renames that dashboard later', () => {
    const db = database();
    try {
      db.exec(migration);
      db.exec("INSERT INTO users VALUES ('new', 'oscar', 'Oscar', '2026-01-01')");
      const dashboard = db.prepare("SELECT title, tabs FROM dashboards WHERE owner_id = 'new'").get() as { title: string; tabs: string };
      expect(dashboard.title).toBe('Oscar');
      expect(JSON.parse(dashboard.tabs)).toEqual([expect.objectContaining({ title: 'Principal' })]);
      db.exec("UPDATE users SET display_name = 'Oscar nuevo' WHERE id = 'new'");
      expect(db.prepare("SELECT title FROM dashboards WHERE owner_id = 'new'").get()).toEqual({ title: 'Oscar' });
      expect(() => insertDashboard(db, 'second', 'new')).toThrow('DASHBOARD_OWNER_EXISTS');
    } finally { db.close(); }
  });

  it('rejects two default tabs at persistence, including on an existing dashboard update', () => {
    const db = database();
    const invalidTabs = JSON.stringify([
      { id: 'a', title: 'A', widgets: [], isDefault: true },
      { id: 'b', title: 'B', widgets: [], isDefault: true },
    ]);
    try {
      db.exec(migration);
      expect(() => insertDashboard(db, 'invalid', 'owner', invalidTabs)).toThrow('DASHBOARD_MULTIPLE_DEFAULT_TABS');
      insertDashboard(db, 'valid', 'owner');
      expect(() => db.prepare('UPDATE dashboards SET tabs = ? WHERE id = ?').run(invalidTabs, 'valid'))
        .toThrow('DASHBOARD_MULTIPLE_DEFAULT_TABS');
      expect(db.prepare("SELECT tabs FROM dashboards WHERE id = 'valid'").get()).toEqual({ tabs: noDefaultTabs });
    } finally { db.close(); }
  });
});
