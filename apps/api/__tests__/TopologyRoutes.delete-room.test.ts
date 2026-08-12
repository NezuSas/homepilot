import * as fs from 'fs';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SQLiteHomeRepository } from '../../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from '../../../packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { TopologyRoutes } from '../routes/TopologyRoutes';

describe('TopologyRoutes - delete room', () => {
  const dbPath = 'topology-delete-room-test.db';
  const routes = new TopologyRoutes(dbPath);
  const ownerRequest = { user: { id: 'owner-1' }, headers: {} } as unknown as HomePilotRequest;

  const createResponse = () => ({
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  }) as unknown as http.ServerResponse;

  const createContainer = () => ({
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(true),
        requireRole: jest.fn().mockReturnValue(true),
      },
    },
    repositories: {
      homeRepository: new SQLiteHomeRepository(dbPath),
      roomRepository: new SQLiteRoomRepository(dbPath),
    },
  }) as unknown as BootstrapContainer;

  beforeEach(() => {
    SqliteDatabaseManager.closeAll();
    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    db.exec(`
      DROP TABLE IF EXISTS devices;
      DROP TABLE IF EXISTS rooms;
      DROP TABLE IF EXISTS homes;
      CREATE TABLE homes (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, entity_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE rooms (id TEXT PRIMARY KEY, home_id TEXT NOT NULL, name TEXT NOT NULL, entity_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE devices (id TEXT PRIMARY KEY, home_id TEXT NOT NULL, room_id TEXT, external_id TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, vendor TEXT NOT NULL, status TEXT NOT NULL, last_known_state TEXT, invert_state INTEGER NOT NULL DEFAULT 0, entity_version INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    `);
    db.prepare("INSERT INTO homes VALUES ('home-1', 'owner-1', 'Casa', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
    db.prepare("INSERT INTO rooms VALUES ('room-1', 'home-1', 'Sala', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
    db.prepare("INSERT INTO devices VALUES ('device-1', 'home-1', 'room-1', 'ha:light.sala', 'Luz sala', 'light', 'Home Assistant', 'ASSIGNED', '{\"state\":\"on\"}', 0, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')").run();
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('BDD AC8: deletes an owned room and atomically unassigns its devices', async () => {
    const response = createResponse();
    await routes.handle(ownerRequest, response, '/api/v1/rooms/room-1', 'DELETE', createContainer());

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare('SELECT id FROM rooms WHERE id = ?').get('room-1')).toBeUndefined();
    expect(db.prepare('SELECT room_id, status, entity_version FROM devices WHERE id = ?').get('device-1')).toEqual({ room_id: null, status: 'PENDING', entity_version: 2 });
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"unassignedDevices":1'));
  });

  it('BDD AC9: rejects a non-owner without changing the room or its devices', async () => {
    const response = createResponse();
    const foreignRequest = { user: { id: 'other-owner' }, headers: {} } as unknown as HomePilotRequest;
    await routes.handle(foreignRequest, response, '/api/v1/rooms/room-1', 'DELETE', createContainer());

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare('SELECT id FROM rooms WHERE id = ?').get('room-1')).toBeDefined();
    expect(db.prepare('SELECT room_id FROM devices WHERE id = ?').get('device-1')).toEqual({ room_id: 'room-1' });
    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
  });

  it('BDD AC8: reports a missing room without changing persisted devices', async () => {
    const response = createResponse();
    await routes.handle(ownerRequest, response, '/api/v1/rooms/missing-room', 'DELETE', createContainer());

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare('SELECT room_id FROM devices WHERE id = ?').get('device-1')).toEqual({ room_id: 'room-1' });
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
});