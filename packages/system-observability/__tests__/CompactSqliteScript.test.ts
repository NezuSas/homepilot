import Database from 'better-sqlite3';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const helper = join(process.cwd(), 'scripts', 'lib', 'compact-sqlite.cjs');
const script = join(process.cwd(), 'scripts', 'compact-database.sh');

function runHelper(source: string, target: string) {
  return spawnSync(process.execPath, [helper], { encoding: 'utf8', env: { ...process.env, HP_DB_SOURCE: source, HP_DB_TARGET: target } });
}

describe('Feature: compacting the database after a large cleanup', () => {
  let directory: string;
  beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'hp-compact-')); });
  afterEach(() => { rmSync(directory, { recursive: true, force: true }); });

  function bloatedDatabase(): string {
    const path = join(directory, 'homepilot.db');
    const db = new Database(path);
    db.exec('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT); CREATE TABLE activity_logs (id INTEGER PRIMARY KEY, type TEXT, data TEXT); CREATE INDEX idx_type ON activity_logs(type);');
    db.prepare("INSERT INTO users VALUES ('u1', 'admin')").run();
    const insert = db.prepare('INSERT INTO activity_logs (type, data) VALUES (?, ?)');
    db.transaction(() => { for (let index = 0; index < 4000; index += 1) insert.run('STATE_CHANGED', 'x'.repeat(400)); })();
    db.prepare('DELETE FROM activity_logs WHERE id > 20').run();
    db.close();
    return path;
  }

  it('Scenario: Given a database whose rows were mostly deleted When it is compacted Then the copy is smaller and holds identical data', () => {
    const source = bloatedDatabase();
    const target = join(directory, 'homepilot.compact.db');

    const result = runHelper(source, target);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('users: 1 -> 1');
    expect(result.stdout).toContain('activity_logs: 20 -> 20');
    expect(result.stdout).toContain('VERIFICADO');
    expect(statSync(target).size).toBeLessThan(statSync(source).size / 4);
    const compact = new Database(target, { readonly: true });
    expect(compact.prepare('SELECT name FROM users').get()).toEqual({ name: 'admin' });
    expect(compact.prepare("SELECT count(*) AS c FROM sqlite_master WHERE type = 'index' AND name = 'idx_type'").get()).toEqual({ c: 1 });
    compact.close();
  });

  it('Scenario: Given a leftover compact copy from a previous attempt When compacting again Then it is replaced', () => {
    const source = bloatedDatabase();
    const target = join(directory, 'homepilot.compact.db');
    expect(runHelper(source, target).status).toBe(0);

    expect(runHelper(source, target).status).toBe(0);
  });

  it('Scenario: Given a missing database When compacting Then it fails clearly and writes nothing', () => {
    const target = join(directory, 'homepilot.compact.db');

    const result = runHelper(join(directory, 'absent.db'), target);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('No existe la base de datos');
    expect(existsSync(target)).toBe(false);
  });

  it('Scenario: Given the operator script When its syntax is checked Then it is valid and always restarts the API', () => {
    const syntax = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
    expect(syntax.status).toBe(0);

    const source = readFileSync(script, 'utf8');
    expect(source).toContain("trap restart_api EXIT");
    expect(source).toContain('docker start "$API_CONTAINER"');
    // The original file is only moved after the helper has verified the copy.
    expect(source.indexOf('compact-sqlite.cjs')).toBeLessThan(source.indexOf('homepilot.old.db'));
    expect(source).not.toMatch(/rm[^\n]*homepilot\.db"?\s/);
  });
});
