import { EventEmitter } from 'events';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import { TopologyRoutes } from '../routes/TopologyRoutes';

const home = {
  id: 'home-1',
  ownerId: 'owner-1',
  name: 'Casa principal',
  entityVersion: 1,
  createdAt: '2026-08-17T00:00:00.000Z',
  updatedAt: '2026-08-17T00:00:00.000Z',
};

function createRequest(body?: unknown): HomePilotRequest {
  const request = new EventEmitter() as HomePilotRequest;
  request.headers = {};
  request.user = { id: 'owner-1', username: 'Oscar', role: 'admin', displayName: null, avatarDataUri: null };
  request._fastifyParsedBody = JSON.stringify(body ?? {});
  return request;
}

function createResponse(): http.ServerResponse {
  return {
    writeHead: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  } as unknown as http.ServerResponse;
}

function createContainer(): BootstrapContainer {
  return {
    guards: {
      authGuard: {
        protect: jest.fn().mockResolvedValue(true),
        requireRole: jest.fn().mockReturnValue(true),
      },
    },
    repositories: {
      homeRepository: {
        findAll: jest.fn().mockResolvedValue([]),
        findHomeById: jest.fn().mockResolvedValue(home),
        findHomesByUserId: jest.fn().mockResolvedValue([home]),
        saveHome: jest.fn().mockResolvedValue(undefined),
      },
      roomRepository: {
        findRoomsByHomeId: jest.fn().mockResolvedValue([]),
        findRoomById: jest.fn().mockResolvedValue({ id: 'room-1', homeId: home.id, name: 'Sala' }),
      },
      deviceRepository: {
        findAll: jest.fn().mockResolvedValue([]),
      },
      activityLogRepository: {
        saveActivity: jest.fn().mockResolvedValue(undefined),
      },
    },
    adapters: {
      topologyEventPublisher: { publish: jest.fn().mockRejectedValue(new Error('offline event bus')) },
      commandDispatcher: { dispatch: jest.fn() },
      deviceEventPublisher: { publish: jest.fn().mockResolvedValue(undefined) },
    },
  } as unknown as BootstrapContainer;
}

describe('TopologyRoutes - additional contracts', () => {
  const routes = new TopologyRoutes();

  it('creates the first installation home and keeps the persisted result when event publication is unavailable', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Casa nueva' }), response, '/api/v1/homes', 'POST', container);

    expect(container.repositories.homeRepository.saveHome).toHaveBeenCalledWith(expect.objectContaining({
      ownerId: 'owner-1',
      name: 'Casa nueva',
    }));
    expect(container.adapters.topologyEventPublisher.publish).toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Casa nueva'));
  });

  it('rejects a second home before parsing or persisting the requested payload', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findAll as jest.Mock).mockResolvedValue([home]);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Second home' }), response, '/api/v1/homes', 'POST', container);

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(409, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('SINGLE_HOME_INSTALLATION'));
  });

  it('lists rooms for the current installation home after validating ownership', async () => {
    const container = createContainer();
    (container.repositories.roomRepository.findRoomsByHomeId as jest.Mock).mockResolvedValue([
      { id: 'room-1', homeId: home.id, name: 'Sala' },
    ]);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/homes/home-1/rooms', 'GET', container);

    expect(container.repositories.homeRepository.findHomeById).toHaveBeenCalledWith('home-1');
    expect(container.repositories.homeRepository.findHomesByUserId).toHaveBeenCalledWith('owner-1');
    expect(container.repositories.roomRepository.findRoomsByHomeId).toHaveBeenCalledWith('home-1');
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Sala'));
  });

  it('creates a room in the owned home and preserves local success when event publication fails', async () => {
    const container = createContainer();
    (container.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom = jest.fn().mockResolvedValue(undefined);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Cocina' }), response, '/api/v1/homes/home-1/rooms', 'POST', container);

    expect((container.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom).toHaveBeenCalledWith(expect.objectContaining({
      homeId: 'home-1',
      name: 'Cocina',
    }));
    expect(container.adapters.topologyEventPublisher.publish).toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Cocina'));
  });
  it('does not disclose a missing installation home when creating a room', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue(null);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Kitchen' }), response, '/api/v1/homes/missing-home/rooms', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('renames an owned room, increments its version, and keeps persistence authoritative if publishing fails', async () => {
    const container = createContainer();
    const currentRoom = {
      id: 'room-1',
      homeId: 'home-1',
      name: 'Sala',
      entityVersion: 4,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    };
    (container.repositories.roomRepository.findRoomById as jest.Mock).mockResolvedValue(currentRoom);
    (container.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom = jest.fn().mockResolvedValue(undefined);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Sala principal' }), response, '/api/v1/rooms/room-1', 'PATCH', container);

    expect((container.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom).toHaveBeenCalledWith(expect.objectContaining({
      id: 'room-1',
      name: 'Sala principal',
      entityVersion: 5,
    }));
    expect(container.adapters.topologyEventPublisher.publish).toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Sala principal'));
  });
  it('returns a stable not-found contract when renaming a missing room', async () => {
    const container = createContainer();
    (container.repositories.roomRepository.findRoomById as jest.Mock).mockResolvedValue(null);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Kitchen' }), response, '/api/v1/rooms/missing-room', 'PATCH', container);

    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_NOT_FOUND'));
  });
  it('rejects an empty first-home name without persisting anything', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({ name: '   ' }), response, '/api/v1/homes', 'POST', container);

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('rejects invalid room names consistently before persisting a room', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({ name: '   ' }), response, '/api/v1/homes/home-1/rooms', 'POST', container);

    expect(container.adapters.topologyEventPublisher.publish).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });

  it('returns the stable not-found contract when deleting a missing room', async () => {
    const container = createContainer();
    (container.repositories.roomRepository.findRoomById as jest.Mock).mockResolvedValue(null);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/rooms/missing-room', 'DELETE', container);

    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_NOT_FOUND'));
  });
  it('does not disclose an installation home room list to an account outside that home', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/homes/home-1/rooms', 'GET', container);

    expect(container.repositories.roomRepository.findRoomsByHomeId).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('rejects invalid quick room actions before querying the device inventory', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({ action: 'toggle' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(container.repositories.deviceRepository.findAll).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_COMMAND'));
  });

  it('completes a room quick action with no controllable devices without dispatching anything', async () => {
    const container = createContainer();
    (container.repositories.deviceRepository.findAll as jest.Mock).mockResolvedValue([
      { id: 'sensor-1', roomId: 'room-1', type: 'sensor' },
    ]);
    const response = createResponse();

    await routes.handle(createRequest({ action: 'turn_on' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(container.adapters.commandDispatcher.dispatch).not.toHaveBeenCalled();
    expect(container.repositories.activityLogRepository.saveActivity).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(JSON.stringify({ success: true, executed: 0, failed: 0 }));
  });
  it('dispatches every controllable device in a room and records a successful quick action', async () => {
    const container = createContainer();
    const light = {
      id: 'light-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.one',
      name: 'Luz Sala', type: 'light', status: 'ASSIGNED', integrationSource: 'home_assistant',
      vendor: 'Home Assistant', invertState: false, lastKnownState: { state: 'off' },
      entityVersion: 1, createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
    };
    (container.repositories.deviceRepository.findAll as jest.Mock).mockResolvedValue([light]);
    (container.repositories.deviceRepository as unknown as { findDeviceById: jest.Mock }).findDeviceById = jest.fn().mockResolvedValue(light);
    const response = createResponse();

    await routes.handle(createRequest({ action: 'turn_on' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(container.adapters.commandDispatcher.dispatch).toHaveBeenCalledWith('light-1', 'turn_on');
    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCENE_EXECUTION_STARTED',
      data: expect.objectContaining({ roomId: 'room-1', totalActions: 1 }),
    }));
    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCENE_EXECUTION_COMPLETED',
      data: expect.objectContaining({ successCount: 1, failedCount: 0 }),
    }));
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"succeeded":1'));
  });
  it('reports device-level quick-action failures without losing the room audit record', async () => {
    const container = createContainer();
    const light = {
      id: 'light-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.one',
      name: 'Luz Sala', type: 'light', status: 'ASSIGNED', integrationSource: 'home_assistant',
      vendor: 'Home Assistant', invertState: false, lastKnownState: { state: 'on' },
      entityVersion: 1, createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
    };
    (container.repositories.deviceRepository.findAll as jest.Mock).mockResolvedValue([light]);
    (container.repositories.deviceRepository as unknown as { findDeviceById: jest.Mock }).findDeviceById = jest.fn().mockResolvedValue(light);
    (container.adapters.commandDispatcher.dispatch as jest.Mock).mockRejectedValue(new Error('gateway offline'));
    const response = createResponse();

    await routes.handle(createRequest({ action: 'turn_off' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCENE_EXECUTION_FAILED',
      data: expect.objectContaining({ successCount: 0, failedCount: 1 }),
    }));
    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('gateway offline'));
  });
  it('reports a partial room quick action when one device succeeds and another fails', async () => {
    const container = createContainer();
    const lights = [
      { id: 'light-1', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.one', name: 'Luz Uno', type: 'light', status: 'ASSIGNED', integrationSource: 'home_assistant', vendor: 'Home Assistant', invertState: false, lastKnownState: { state: 'off' }, entityVersion: 1, createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z' },
      { id: 'light-2', homeId: 'home-1', roomId: 'room-1', externalId: 'ha:light.two', name: 'Luz Dos', type: 'light', status: 'ASSIGNED', integrationSource: 'home_assistant', vendor: 'Home Assistant', invertState: false, lastKnownState: { state: 'off' }, entityVersion: 1, createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z' },
    ];
    (container.repositories.deviceRepository.findAll as jest.Mock).mockResolvedValue(lights);
    (container.repositories.deviceRepository as unknown as { findDeviceById: jest.Mock }).findDeviceById = jest.fn().mockImplementation(async (id: string) => lights.find((device) => device.id === id));
    (container.adapters.commandDispatcher.dispatch as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('second gateway offline'));
    const response = createResponse();

    await routes.handle(createRequest({ action: 'turn_on' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(container.repositories.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'SCENE_EXECUTION_FAILED',
      data: expect.objectContaining({ successCount: 1, failedCount: 1, isPartial: true }),
    }));
    expect(response.writeHead).toHaveBeenCalledWith(207, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"succeeded":1'));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"failed":1'));
  });
  it('returns a stable failure when a room quick action cannot read the assigned devices', async () => {
    const container = createContainer();
    (container.repositories.deviceRepository.findAll as jest.Mock).mockRejectedValue(new Error('device store unavailable'));
    const response = createResponse();

    await routes.handle(createRequest({ action: 'turn_on' }), response, '/api/v1/rooms/room-1/action', 'POST', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_ACTION_ERROR'));
  });

  it.each(['admin', 'operator', 'parent', 'child', 'guest'] as const)(
    'lists shared homes for the %s role',
    async (role) => {
      const container = createContainer();
      const request = createRequest();
      request.user = { ...request.user!, role };
      const response = createResponse();

      await routes.handle(request, response, '/api/v1/homes', 'GET', container);

      expect(container.repositories.homeRepository.findAll).toHaveBeenCalledTimes(1);
      expect(container.repositories.homeRepository.findHomesByUserId).not.toHaveBeenCalled();
      expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    }
  );

  it('returns an empty rooms collection cleanly when the current installation has no homes', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findAll as jest.Mock).mockResolvedValue([]);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/rooms', 'GET', container);

    expect(container.repositories.roomRepository.findRoomsByHomeId).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith('[]');
  });
  it('lists shared rooms across installation homes and returns a stable database failure', async () => {
    const container = createContainer();
    const secondHome = { ...home, id: 'home-2', name: 'Office' };
    (container.repositories.homeRepository.findAll as jest.Mock).mockResolvedValue([home, secondHome]);
    (container.repositories.roomRepository.findRoomsByHomeId as jest.Mock)
      .mockResolvedValueOnce([{ id: 'room-1', homeId: home.id, name: 'Sala' }])
      .mockResolvedValueOnce([{ id: 'room-2', homeId: secondHome.id, name: 'Office' }]);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/rooms', 'GET', container);

    expect(container.repositories.roomRepository.findRoomsByHomeId).toHaveBeenCalledWith('home-1');
    expect(container.repositories.roomRepository.findRoomsByHomeId).toHaveBeenCalledWith('home-2');
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('Office'));

    const failedContainer = createContainer();
    (failedContainer.repositories.homeRepository.findAll as jest.Mock).mockRejectedValue(new Error('home store unavailable'));
    const failedResponse = createResponse();

    await routes.handle(createRequest(), failedResponse, '/api/v1/rooms', 'GET', failedContainer);

    expect(failedResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(failedResponse.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });

  it('stops topology processing when the authentication guard rejects the request', async () => {
    const container = createContainer();
    (container.guards.authGuard.protect as jest.Mock).mockResolvedValue(false);
    const response = createResponse();

    await expect(routes.handle(createRequest(), response, '/api/v1/homes', 'GET', container)).resolves.toBe(true);

    expect(container.repositories.homeRepository.findAll).not.toHaveBeenCalled();
    expect(response.writeHead).not.toHaveBeenCalled();
  });
  it('returns a database error when loading homes fails', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findAll as jest.Mock).mockRejectedValue(new Error('home store unavailable'));
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/homes', 'GET', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('DB_ERROR'));
  });});
describe('Feature: home rename administration contracts', () => {
  const routes = new TopologyRoutes();

  it('updates a home name only inside the current installation and increments its version', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({ name: '  Casa renovada  ' }), response, '/api/v1/homes/home-1', 'PATCH', container);

    expect(container.repositories.homeRepository.saveHome).toHaveBeenCalledWith(expect.objectContaining({
      id: 'home-1',
      name: 'Casa renovada',
      entityVersion: 2,
    }));
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('rejects a home rename when the target does not exist', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomeById as jest.Mock).mockResolvedValue(null);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Casa renovada' }), response, '/api/v1/homes/missing', 'PATCH', container);

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HOME_NOT_FOUND'));
  });

  it('rejects a home rename outside the current installation', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Casa renovada' }), response, '/api/v1/homes/home-1', 'PATCH', container);

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });

  it('preserves the stable error contract when a home rename cannot be persisted', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.saveHome as jest.Mock).mockRejectedValue(new Error('storage offline'));
    const response = createResponse();

    await routes.handle(createRequest({ name: 'Casa renovada' }), response, '/api/v1/homes/home-1', 'PATCH', container);

    expect(response.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('HOME_RENAME_ERROR'));
  });
  it('deletes an owned room and returns the number of devices unassigned atomically', async () => {
    const container = createContainer();
    (container.repositories.roomRepository as unknown as { deleteRoomAndUnassignDevices: jest.Mock }).deleteRoomAndUnassignDevices = jest.fn().mockResolvedValue(3);
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/rooms/room-1', 'DELETE', container);

    expect((container.repositories.roomRepository as unknown as { deleteRoomAndUnassignDevices: jest.Mock }).deleteRoomAndUnassignDevices)
      .toHaveBeenCalledWith('room-1', expect.any(String));
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"unassignedDevices":3'));
  });

  it('does not mutate persistence when a room home is outside the current installation', async () => {
    const container = createContainer();
    (container.repositories.homeRepository.findHomesByUserId as jest.Mock).mockResolvedValue([]);
    (container.repositories.roomRepository as unknown as { deleteRoomAndUnassignDevices: jest.Mock }).deleteRoomAndUnassignDevices = jest.fn();
    const response = createResponse();

    await routes.handle(createRequest(), response, '/api/v1/rooms/room-1', 'DELETE', container);

    expect((container.repositories.roomRepository as unknown as { deleteRoomAndUnassignDevices: jest.Mock }).deleteRoomAndUnassignDevices).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_NOT_FOUND'));
  });
});
describe('Feature: topology mutation failure and authorization contracts', () => {
  const routes = new TopologyRoutes();

  it('stops every administrative topology mutation before persistence when the role guard rejects access', async () => {
    const container = createContainer();
    (container.guards.authGuard.requireRole as jest.Mock).mockReturnValue(false);

    for (const [pathname, method, body] of [
      ['/api/v1/homes', 'POST', { name: 'Blocked home' }],
      ['/api/v1/homes/home-1', 'PATCH', { name: 'Blocked home' }],
      ['/api/v1/homes/home-1/rooms', 'POST', { name: 'Blocked room' }],
      ['/api/v1/rooms/room-1', 'PATCH', { name: 'Blocked room' }],
      ['/api/v1/rooms/room-1', 'DELETE', undefined],
    ] as const) {
      const response = createResponse();
      await routes.handle(createRequest(body), response, pathname, method, container);
      expect(response.writeHead).not.toHaveBeenCalled();
    }

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
  });

  it('maps home creation and room persistence failures to stable public contracts', async () => {
    const failedHomeContainer = createContainer();
    (failedHomeContainer.repositories.homeRepository.findAll as jest.Mock).mockRejectedValue(new Error('home store offline'));
    const homeResponse = createResponse();

    await routes.handle(createRequest({ name: 'Casa nueva' }), homeResponse, '/api/v1/homes', 'POST', failedHomeContainer);

    expect(homeResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(homeResponse.end).toHaveBeenCalledWith(expect.stringContaining('HOME_CREATE_ERROR'));

    const createRoomContainer = createContainer();
    (createRoomContainer.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom = jest.fn().mockRejectedValue(new Error('room store offline'));
    const createRoomResponse = createResponse();
    await routes.handle(createRequest({ name: 'Cocina' }), createRoomResponse, '/api/v1/homes/home-1/rooms', 'POST', createRoomContainer);

    expect(createRoomResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(createRoomResponse.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_CREATE_ERROR'));

    const renameRoomContainer = createContainer();
    (renameRoomContainer.repositories.roomRepository as unknown as { saveRoom: jest.Mock }).saveRoom = jest.fn().mockRejectedValue(new Error('room store offline'));
    const renameRoomResponse = createResponse();
    await routes.handle(createRequest({ name: 'Sala principal' }), renameRoomResponse, '/api/v1/rooms/room-1', 'PATCH', renameRoomContainer);

    expect(renameRoomResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(renameRoomResponse.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_RENAME_ERROR'));
  });

  it('maps a room deletion persistence failure and keeps unmatched topology requests unclaimed', async () => {
    const container = createContainer();
    (container.repositories.roomRepository as unknown as { deleteRoomAndUnassignDevices: jest.Mock }).deleteRoomAndUnassignDevices = jest.fn().mockRejectedValue(new Error('room store offline'));
    const deleteResponse = createResponse();

    await routes.handle(createRequest(), deleteResponse, '/api/v1/rooms/room-1', 'DELETE', container);

    expect(deleteResponse.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
    expect(deleteResponse.end).toHaveBeenCalledWith(expect.stringContaining('ROOM_DELETE_ERROR'));

    const unmatchedResponse = createResponse();
    await expect(routes.handle(createRequest(), unmatchedResponse, '/api/v1/topology/unknown', 'GET', createContainer())).resolves.toBe(false);
  });

  it('rejects home creation without a string name before any persistence is attempted', async () => {
    const container = createContainer();
    const response = createResponse();

    await routes.handle(createRequest({}), response, '/api/v1/homes', 'POST', container);

    expect(container.repositories.homeRepository.saveHome).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('INVALID_INPUT'));
  });
});