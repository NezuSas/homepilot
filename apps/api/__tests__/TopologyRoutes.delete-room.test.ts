import { EventEmitter } from 'events';
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
  const routes = new TopologyRoutes();
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
    adapters: { topologyEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) } },
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

  it('BDD AC9: allows another active user on the shared home to delete a room', async () => {
    const response = createResponse();
    const foreignRequest = { user: { id: 'other-owner' }, headers: {} } as unknown as HomePilotRequest;
    await routes.handle(foreignRequest, response, '/api/v1/rooms/room-1', 'DELETE', createContainer());

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare('SELECT id FROM rooms WHERE id = ?').get('room-1')).toBeUndefined();
    expect(db.prepare('SELECT room_id FROM devices WHERE id = ?').get('device-1')).toEqual({ room_id: null });
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('BDD AC8: reports a missing room without changing persisted devices', async () => {
    const response = createResponse();
    await routes.handle(ownerRequest, response, '/api/v1/rooms/missing-room', 'DELETE', createContainer());

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare('SELECT room_id FROM devices WHERE id = ?').get('device-1')).toEqual({ room_id: 'room-1' });
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('BDD AC4: exposes the installation topology to an authenticated shared-role user', async () => {
    const request = { user: { id: 'operator-1', role: 'operator' }, headers: {} } as unknown as HomePilotRequest;
    const homesResponse = createResponse();
    const roomsResponse = createResponse();

    await routes.handle(request, homesResponse, '/api/v1/homes', 'GET', createContainer());
    await routes.handle(request, roomsResponse, '/api/v1/rooms', 'GET', createContainer());

    expect(homesResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(homesResponse.end).toHaveBeenCalledWith(expect.stringContaining('"id":"home-1"'));
    expect(roomsResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(roomsResponse.end).toHaveBeenCalledWith(expect.stringContaining('"id":"room-1"'));
  });
  it('BDD AC1: prevents a second home from being created in a single-home installation', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({ name: 'Another home' });
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/homes', 'POST', createContainer());

    expect(response.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('SINGLE_HOME_INSTALLATION'));
  });

  it('BDD AC3: reads and renames the current installation home for its administrator', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({ name: 'Casa actualizada' });
    const roomsResponse = createResponse();
    const renameResponse = createResponse();

    await routes.handle(request, roomsResponse, '/api/v1/homes/home-1/rooms', 'GET', createContainer());
    await routes.handle(request, renameResponse, '/api/v1/homes/home-1', 'PATCH', createContainer());

    expect(roomsResponse.end).toHaveBeenCalledWith(expect.stringContaining('"Sala"'));
    expect(renameResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(renameResponse.end).toHaveBeenCalledWith(expect.stringContaining('Casa actualizada'));
  });

  it('BDD AC5: creates and renames a room owned by the current installation', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({ name: 'Cocina' });
    const roomCreateResponse = createResponse();

    await routes.handle(request, roomCreateResponse, '/api/v1/homes/home-1/rooms', 'POST', createContainer());

    expect(roomCreateResponse.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    const createdRoom = JSON.parse((roomCreateResponse.end as jest.Mock).mock.calls[0][0]) as { id: string };
    request._fastifyParsedBody = JSON.stringify({ name: 'Cocina principal' });
    const renameResponse = createResponse();
    await routes.handle(request, renameResponse, `/api/v1/rooms/${createdRoom.id}`, 'PATCH', createContainer());

    expect(renameResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(renameResponse.end).toHaveBeenCalledWith(expect.stringContaining('Cocina principal'));
  });

  it('BDD AC5: rejects malformed room payloads before attempting persistence', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({});
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/homes/home-1/rooms', 'POST', createContainer());

    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });
  it('returns validation errors for empty home and room names without persisting changes', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    const homeResponse = createResponse();
    const roomResponse = createResponse();

    request._fastifyParsedBody = JSON.stringify({ name: '   ' });
    await routes.handle(request, homeResponse, '/api/v1/homes/home-1', 'PATCH', createContainer());
    request._fastifyParsedBody = JSON.stringify({});
    await routes.handle(request, roomResponse, '/api/v1/rooms/room-1', 'PATCH', createContainer());

    expect(homeResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(homeResponse.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
    expect(roomResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(roomResponse.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('does not expose rooms for a missing home', async () => {
    const request = { user: { id: 'owner-1', role: 'admin' }, headers: {} } as unknown as HomePilotRequest;
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/homes/missing-home/rooms', 'GET', createContainer());

    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HOME_NOT_FOUND'));
  });
  it('returns an empty room collection when the installation has no homes', async () => {
    const response = createResponse();
    const container = createContainer() as any;
    container.repositories.homeRepository.findAll = jest.fn().mockResolvedValue([]);

    await routes.handle({ user: { id: 'guest-1', role: 'guest' }, headers: {} } as unknown as HomePilotRequest, response, '/api/v1/rooms', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith('[]');
  });

  it('returns DB_ERROR contracts when topology reads fail', async () => {
    const homesResponse = createResponse();
    const roomsResponse = createResponse();
    const failingHomes = createContainer() as any;
    failingHomes.repositories.homeRepository.findAll = jest.fn().mockRejectedValue(new Error('database unavailable'));

    await routes.handle({ user: { id: 'admin-1', role: 'admin' }, headers: {} } as unknown as HomePilotRequest, homesResponse, '/api/v1/homes', 'GET', failingHomes);
    await routes.handle({ user: { id: 'admin-1', role: 'admin' }, headers: {} } as unknown as HomePilotRequest, roomsResponse, '/api/v1/rooms', 'GET', failingHomes);

    expect(homesResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(homesResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
    expect(roomsResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(roomsResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('does not create, rename, or delete topology resources when the role guard denies access', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'guest', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({ name: 'Blocked room' });
    const response = createResponse();
    const container = createContainer() as any;
    container.guards.authGuard.requireRole.mockReturnValue(false);

    await routes.handle(request, response, '/api/v1/homes/home-1/rooms', 'POST', container);
    await routes.handle(request, response, '/api/v1/rooms/room-1', 'PATCH', container);
    await routes.handle(request, response, '/api/v1/rooms/room-1', 'DELETE', container);

    const db = SqliteDatabaseManager.getInstance(dbPath, false);
    expect(db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE name = 'Blocked room'").get()).toEqual({ count: 0 });
    expect(db.prepare("SELECT name FROM rooms WHERE id = 'room-1'").get()).toEqual({ name: 'Sala' });
  });

  it('does not disclose unknown homes when creating a room outside the authorized installation', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    request._fastifyParsedBody = JSON.stringify({ name: 'Cocina' });
    const response = createResponse();

    await routes.handle(request, response, '/api/v1/homes/missing-home/rooms', 'POST', createContainer());

    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('validates room quick actions and succeeds without dispatching when no controllable device is assigned', async () => {
    const request = new EventEmitter() as HomePilotRequest;
    request.user = { id: 'owner-1', username: 'owner', role: 'admin', displayName: null, avatarDataUri: null };
    request.headers = {};
    const invalidResponse = createResponse();
    const emptyResponse = createResponse();
    const container = createContainer() as any;
    container.repositories.deviceRepository = { findAll: jest.fn().mockResolvedValue([]) };
    container.repositories.activityLogRepository = { saveActivity: jest.fn().mockResolvedValue(undefined) };
    container.adapters.commandDispatcher = { dispatch: jest.fn() };
    container.adapters.deviceEventPublisher = { publish: jest.fn() };

    request._fastifyParsedBody = JSON.stringify({ action: 'dim' });
    await routes.handle(request, invalidResponse, '/api/v1/rooms/room-1/action', 'POST', container);
    request._fastifyParsedBody = JSON.stringify({ action: 'turn_off' });
    await routes.handle(request, emptyResponse, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(invalidResponse.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(emptyResponse.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(emptyResponse.end).toHaveBeenCalledWith(JSON.stringify({ success: true, executed: 0, failed: 0 }));
    expect(container.repositories.activityLogRepository.saveActivity).not.toHaveBeenCalled();
  });

  it('uses the user-scoped topology query for a role outside the shared role set', async () => {
    const homesResponse = createResponse();
    const roomsResponse = createResponse();
    const request = { user: { id: 'outside-user', role: 'viewer' }, headers: {} } as unknown as HomePilotRequest;
    const container = createContainer() as unknown as {
      repositories: {
        homeRepository: { findAll: jest.Mock; findHomesByUserId: jest.Mock };
        roomRepository: { findRoomsByHomeId: jest.Mock };
      };
    } & BootstrapContainer;
    container.repositories.homeRepository.findAll = jest.fn();
    container.repositories.homeRepository.findHomesByUserId = jest.fn().mockResolvedValue([]);
    container.repositories.roomRepository.findRoomsByHomeId = jest.fn();

    await routes.handle(request, homesResponse, '/api/v1/homes', 'GET', container);
    await routes.handle(request, roomsResponse, '/api/v1/rooms', 'GET', container);

    expect(container.repositories.homeRepository.findHomesByUserId).toHaveBeenCalledWith('outside-user');
    expect(container.repositories.homeRepository.findAll).not.toHaveBeenCalled();
    expect(homesResponse.end).toHaveBeenCalledWith('[]');
    expect(roomsResponse.end).toHaveBeenCalledWith('[]');
  });});

describe('Feature: Room quick action execution contracts', () => {
  const routes = new TopologyRoutes();
  const response = () => ({ writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() }) as unknown as http.ServerResponse;
  const light = {
    id: 'light-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.sala', name: 'Sala', type: 'light',
    vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false, lastKnownState: { state: 'off' }, entityVersion: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const makeContainer = (dispatch: jest.Mock) => ({
    guards: { authGuard: { protect: jest.fn().mockResolvedValue(true) } },
    repositories: {
      roomRepository: { findRoomById: jest.fn().mockResolvedValue({ id: 'room-1', homeId: 'home-1', name: 'Sala' }) },
      homeRepository: { findHomeById: jest.fn().mockResolvedValue({ id: 'home-1' }), findHomesByUserId: jest.fn().mockResolvedValue([{ id: 'home-1' }]) },
      deviceRepository: { findAll: jest.fn().mockResolvedValue([light]), findDeviceById: jest.fn().mockResolvedValue(light), saveDevice: jest.fn().mockResolvedValue(undefined) },
      activityLogRepository: { saveActivity: jest.fn().mockResolvedValue(undefined) },
    },
    adapters: { commandDispatcher: { dispatch }, deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) } },
  }) as unknown as BootstrapContainer;
  const request = () => ({ headers: {}, user: { id: 'owner-1', username: 'Oscar', role: 'admin' }, _fastifyParsedBody: JSON.stringify({ action: 'turn_on' }) }) as unknown as HomePilotRequest;

  it('returns a successful execution summary after dispatching every controllable device', async () => {
    const dispatch = jest.fn().mockResolvedValue(undefined);
    const container = makeContainer(dispatch);
    const res = response();
    await routes.handle(request(), res, '/api/v1/rooms/room-1/action', 'POST', container);
    expect(dispatch).toHaveBeenCalledWith('light-1', 'turn_on');
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"succeeded":1'));
    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledTimes(3);
  });

  it('returns a partial execution summary when one device command is rejected', async () => {
    const failedLight = { ...light, id: 'light-2' };
    const dispatch = jest.fn().mockImplementation((id: string) => id === 'light-2' ? Promise.reject(new Error('bridge failed')) : Promise.resolve());
    const container = makeContainer(dispatch) as unknown as { repositories: { deviceRepository: { findAll: jest.Mock; findDeviceById: jest.Mock } } } & BootstrapContainer;
    container.repositories.deviceRepository.findAll.mockResolvedValue([light, failedLight]);
    container.repositories.deviceRepository.findDeviceById.mockImplementation((id: string) => Promise.resolve(id === 'light-2' ? failedLight : light));
    const res = response();
    await routes.handle(request(), res, '/api/v1/rooms/room-1/action', 'POST', container);
    expect(res.writeHead).toHaveBeenCalledWith(207, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('bridge failed'));
  });
  it('returns a failed execution summary when every room device command is rejected', async () => {
    const dispatch = jest.fn().mockRejectedValue(new Error('bridge unavailable'));
    const container = makeContainer(dispatch);
    const res = response();

    await routes.handle(request(), res, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('"succeeded":0'));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('bridge unavailable'));
    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCENE_EXECUTION_FAILED',
    }));
  });
  it('rejects a room quick action outside the supported command set', async () => {
    const dispatch = jest.fn();
    const container = makeContainer(dispatch);
    const res = response();
    const invalidRequest = {
      headers: {},
      user: { id: 'owner-1', username: 'Oscar', role: 'admin' },
      _fastifyParsedBody: JSON.stringify({ action: 'toggle' })
    } as unknown as HomePilotRequest;

    await routes.handle(invalidRequest, res, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_COMMAND'));
    expect(dispatch).not.toHaveBeenCalled();
  });
});