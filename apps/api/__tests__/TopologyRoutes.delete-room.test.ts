import * as http from 'http';
import * as fs from 'fs';
import { BootstrapContainer } from '../../../bootstrap';
import { SqliteDatabaseManager } from '../../../packages/shared/infrastructure/database/SqliteDatabaseManager';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { TopologyRoutes } from '../routes/TopologyRoutes';

describe('TopologyRoutes - delete room', () => {
  const dbPath = 'topology-delete-room-test.db';
  const routes = new TopologyRoutes(dbPath);
  const request = { user: { id: 'owner-1' }, headers: {} } as unknown as HomePilotRequest;

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
  }) as unknown as BootstrapContainer;

  beforeEach(() => {
    SqliteDatabaseManager.closeAll();
    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    db.exec(`
      DROP TABLE IF EXISTS devices;
      DROP TABLE IF EXISTS rooms;
      DROP TABLE IF EXISTS homes;

      CREATE TABLE homes (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE rooms (
        id TEXT PRIMARY KEY,
        home_id TEXT NOT NULL,
        name TEXT NOT NULL,
        entity_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE devices (
        id TEXT PRIMARY KEY,
        home_id TEXT NOT NULL,
        room_id TEXT,
        external_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        vendor TEXT NOT NULL,
        status TEXT NOT NULL,
        last_known_state TEXT,
        invert_state INTEGER NOT NULL DEFAULT 0,
        entity_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    db.prepare(`
      INSERT INTO homes (id, owner_id, name, entity_version, created_at, updated_at)
      VALUES ('home-1', 'owner-1', 'Casa', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `).run();

    db.prepare(`
      INSERT INTO rooms (id, home_id, name, entity_version, created_at, updated_at)
      VALUES ('room-1', 'home-1', 'Sala', 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')
    `).run();

    db.prepare(`
      INSERT INTO devices (
        id, home_id, room_id, external_id, name, type, vendor, status,
        last_known_state, invert_state, entity_version, created_at, updated_at
      )
      VALUES (
        'device-1', 'home-1', 'room-1', 'ha:light.sala', 'Luz sala', 'light', 'Home Assistant', 'ASSIGNED',
        '{"state":"on"}', 0, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z'
      )
    `).run();
  });

  afterEach(() => {
    SqliteDatabaseManager.closeAll();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('deletes the room and unassigns its devices', async () => {
    const response = createResponse();
    const container = createContainer();

    await routes.handle(request, response, '/api/v1/rooms/room-1', 'DELETE', container);

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get('room-1');
    const device = db.prepare('SELECT room_id, status, entity_version FROM devices WHERE id = ?').get('device-1') as {
      room_id: string | null;
      status: string;
      entity_version: number;
    };

    expect(room).toBeUndefined();
    expect(device.room_id).toBeNull();
    expect(device.status).toBe('PENDING');
    expect(device.entity_version).toBe(2);
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"unassignedDevices":1'));
  });
});
