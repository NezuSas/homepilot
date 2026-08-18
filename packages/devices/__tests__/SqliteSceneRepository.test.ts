import Database from 'better-sqlite3';
import { SqliteSceneRepository } from '../infrastructure/repositories/SqliteSceneRepository';
import type { Scene } from '../domain/Scene';

const scene = (id: string, overrides: Partial<Scene> = {}): Scene => ({
  id, homeId: 'home-1', roomId: null, name: id,
  actions: [{ deviceId: 'device-1', command: { name: 'turn_on', params: { brightness: 50 } }, delayMs: 25, continueOnFailure: true }],
  createdAt: `2026-08-17T00:00:0${id.at(-1)}.000Z`, updatedAt: '2026-08-17T00:00:00.000Z', ...overrides
});

describe('SqliteSceneRepository', () => {
  let database: Database.Database;
  let repository: SqliteSceneRepository;

  beforeEach(() => {
    database = new Database(':memory:');
    database.exec('CREATE TABLE scenes (id TEXT PRIMARY KEY, home_id TEXT NOT NULL, room_id TEXT, name TEXT NOT NULL, actions TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
    repository = new SqliteSceneRepository(database);
  });

  afterEach(() => database.close());

  it('persists the modern payload including sequential execution mode and updates atomically', async () => {
    await repository.saveScene(scene('scene-1', { executionMode: 'sequential' }));
    await repository.saveScene(scene('scene-1', { name: 'Updated', executionMode: 'parallel', updatedAt: '2026-08-17T01:00:00.000Z' }));

    await expect(repository.findSceneById('scene-1')).resolves.toEqual(expect.objectContaining({
      name: 'Updated', executionMode: 'parallel', actions: [expect.objectContaining({ delayMs: 25, continueOnFailure: true })]
    }));
    expect(database.prepare('SELECT COUNT(*) AS count FROM scenes').get()).toEqual({ count: 1 });
  });

  it('maps legacy action arrays, sorts home/global listings, returns null, and deletes silently', async () => {
    database.prepare('INSERT INTO scenes (id, home_id, room_id, name, actions, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run('legacy', 'home-1', null, 'Legacy', JSON.stringify([{ deviceId: 'd', command: 'turn_off' }]), '2026-08-17T00:00:01.000Z', '');
    await repository.saveScene(scene('scene-2', { homeId: 'home-2', createdAt: '2026-08-17T00:00:02.000Z' }));

    await expect(repository.findSceneById('legacy')).resolves.toMatchObject({ id: 'legacy', actions: [{ deviceId: 'd', command: 'turn_off' }] });
    await expect(repository.findSceneById('missing')).resolves.toBeNull();
    await expect(repository.findScenesByHomeId('home-1')).resolves.toEqual([expect.objectContaining({ id: 'legacy' })]);
    await expect(repository.findAll()).resolves.toEqual([expect.objectContaining({ id: 'scene-2' }), expect.objectContaining({ id: 'legacy' })]);

    await repository.deleteScene('missing');
    await repository.deleteScene('legacy');
    await expect(repository.findSceneById('legacy')).resolves.toBeNull();
  });
});