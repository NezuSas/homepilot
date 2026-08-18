import { DeviceRoutes } from '../routes/DeviceRoutes';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device, DeviceSemanticType } from '../../../packages/devices/domain/types';
import { Home } from '../../../packages/topology/domain/types';

// Mocks
const mockDeviceRepository = {
  findDeviceById: jest.fn(),
  updateSemanticType: jest.fn(),
  saveDevice: jest.fn(),
  findAll: jest.fn(),
  findByExternalIdAndHomeId: jest.fn(),
  findByExternalId: jest.fn(),
  findInboxByHomeId: jest.fn(),
  findAllByHomeId: jest.fn(),
  findAllOrderedByStatus: jest.fn(),
  findAllExternalIdsByPrefix: jest.fn(),
};

const mockHomeRepository = {
  findHomeById: jest.fn(),
  createHome: jest.fn(),
  findHomesByOwnerId: jest.fn(),
  findHomesByUserId: jest.fn(),
};

const mockAuthGuard = {
  protect: jest.fn().mockResolvedValue(true),
  requireAuth: jest.fn(),
  requireRole: jest.fn(),
};

describe('DeviceRoutes - Semantic Classification', () => {
  let routes: DeviceRoutes;
  let mockContainer: Partial<BootstrapContainer>;
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockContainer = {
      repositories: {
        deviceRepository: mockDeviceRepository as any,
        homeRepository: mockHomeRepository as any,
      } as any,
      guards: {
        authGuard: mockAuthGuard as any,
      } as any,
      services: {} as any,
    };

    routes = new DeviceRoutes();

    mockReq = {
      url: '/api/v1/devices/dev-1/semantic-type',
      method: 'PATCH',
      user: { id: 'user-1' },
      headers: {},
      raw: {
        _fastifyParsedBody: null,
      },
    };

    mockRes = {
      writeHead: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      hijack: jest.fn(),
    };

    mockAuthGuard.requireRole.mockReturnValue(true);

    const mockDevice: Device = {
      id: 'dev-1',
      homeId: 'home-1',
      roomId: null,
      externalId: 'ext-1',
      name: 'Device 1',
      type: 'switch',
      semanticType: null,
      vendor: 'test',
      status: 'ASSIGNED',
      integrationSource: 'test',
      invertState: false,
      lastKnownState: null,
      entityVersion: 1,
      createdAt: '',
      updatedAt: '',
    };

    const mockHome: Home = {
      id: 'home-1',
      name: 'Home 1',
      ownerId: 'user-1',
      entityVersion: 1,
      createdAt: '',
      updatedAt: '',
    };

    mockDeviceRepository.findDeviceById.mockResolvedValue(mockDevice);
    mockHomeRepository.findHomeById.mockResolvedValue(mockHome);
    mockHomeRepository.findHomesByUserId.mockResolvedValue([mockHome]);
  });

  const runRoute = async (body: any) => {
    mockReq._fastifyParsedBody = JSON.stringify(body);
    return await routes.handle(
      mockReq as HomePilotRequest,
      mockRes as http.ServerResponse,
      '/api/v1/devices/dev-1/semantic-type',
      'PATCH',
      mockContainer as BootstrapContainer
    );
  };

  it('stops before device access when authentication is rejected', async () => {
    mockAuthGuard.protect.mockResolvedValueOnce(false);

    await expect(runRoute({ semanticType: 'light' })).resolves.toBe(true);

    expect(mockDeviceRepository.findDeviceById).not.toHaveBeenCalled();
    expect(mockRes.writeHead).not.toHaveBeenCalled();
  });
  it('rejects missing semanticType key with 400', async () => {
    await runRoute({});
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Missing semanticType key'));
  });

  it('rejects arbitrary strings with 400', async () => {
    await runRoute({ semanticType: 'random_string' });
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid semanticType value'));
  });

  it('rejects empty string with 400', async () => {
    await runRoute({ semanticType: '' });
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid semanticType value'));
  });

  it('rejects numbers and booleans with 400', async () => {
    await runRoute({ semanticType: 123 });
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid semanticType value'));

    await runRoute({ semanticType: true });
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Invalid semanticType value'));
  });

  it('accepts valid semantic types and updates', async () => {
    const baseDevice = { id: 'dev-1', homeId: 'home-1', externalId: 'ext-1', name: 'Dev', type: 'switch' };
    mockDeviceRepository.findDeviceById
      .mockResolvedValueOnce(baseDevice) // first find
      .mockResolvedValueOnce({ ...baseDevice, semanticType: 'light' }); // second find

    await runRoute({ semanticType: 'light' });

    expect(mockDeviceRepository.updateSemanticType).toHaveBeenCalledWith('dev-1', 'light');
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"semanticType":"light"'));
  });

  it('accepts null and updates', async () => {
    const baseDevice = { id: 'dev-1', homeId: 'home-1', externalId: 'ext-1', name: 'Dev', type: 'switch' };
    mockDeviceRepository.findDeviceById
      .mockResolvedValueOnce(baseDevice)
      .mockResolvedValueOnce({ ...baseDevice, semanticType: null });

    await runRoute({ semanticType: null });

    expect(mockDeviceRepository.updateSemanticType).toHaveBeenCalledWith('dev-1', null);
    expect(mockRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('"device"'));
  });

  it('returns 404 if device not found on second fetch', async () => {
    const baseDevice = { id: 'dev-1', homeId: 'home-1', externalId: 'ext-1', name: 'Dev', type: 'switch' };
    mockDeviceRepository.findDeviceById
      .mockResolvedValueOnce(baseDevice)
      .mockResolvedValueOnce(null);

    await runRoute({ semanticType: 'light' });
    expect(mockRes.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });
  it('preserves a device unchanged when its patch contains no effective change', async () => {
    const device = {
      id: 'dev-1', homeId: 'home-1', roomId: null, externalId: 'ha:light.sala', name: 'Sala', type: 'light',
      vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false,
      lastKnownState: { state: 'off' }, entityVersion: 3, createdAt: '', updatedAt: '',
    } as Device;
    mockDeviceRepository.findDeviceById.mockResolvedValue(device);
    const response = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };
    mockReq._fastifyParsedBody = JSON.stringify({});

    await routes.handle(mockReq as HomePilotRequest, response as unknown as http.ServerResponse, '/api/v1/devices/dev-1', 'PATCH', mockContainer as BootstrapContainer);

    expect(mockDeviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('"entityVersion":3'));
  });

  it('persists an authorized device name and invert-state update atomically', async () => {
    const device = {
      id: 'dev-1', homeId: 'home-1', roomId: null, externalId: 'ha:light.sala', name: 'Sala', type: 'light',
      vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false,
      lastKnownState: { state: 'off' }, entityVersion: 3, createdAt: '', updatedAt: '2026-08-01T00:00:00.000Z',
    } as Device;
    mockDeviceRepository.findDeviceById.mockResolvedValue(device);
    const response = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };
    mockReq._fastifyParsedBody = JSON.stringify({ name: ' Luz principal ', invertState: true });

    await routes.handle(mockReq as HomePilotRequest, response as unknown as http.ServerResponse, '/api/v1/devices/dev-1', 'PATCH', mockContainer as BootstrapContainer);

    expect(mockDeviceRepository.saveDevice).toHaveBeenCalledWith(expect.objectContaining({
      id: 'dev-1', name: 'Luz principal', invertState: true, entityVersion: 4,
    }));
    expect(response.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('does not expose or change a device that belongs to another home', async () => {
    const device = {
      id: 'dev-1', homeId: 'foreign-home', roomId: null, externalId: 'ha:light.sala', name: 'Sala', type: 'light',
      vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'ha', invertState: false,
      lastKnownState: null, entityVersion: 1, createdAt: '', updatedAt: '',
    } as Device;
    mockDeviceRepository.findDeviceById.mockResolvedValue(device);
    const response = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };
    mockReq._fastifyParsedBody = JSON.stringify({ name: 'No permitido' });

    await routes.handle(mockReq as HomePilotRequest, response as unknown as http.ServerResponse, '/api/v1/devices/dev-1', 'PATCH', mockContainer as BootstrapContainer);

    expect(mockDeviceRepository.saveDevice).not.toHaveBeenCalled();
    expect(response.writeHead).toHaveBeenCalledWith(403, expect.any(Object));
    expect(response.end).toHaveBeenCalledWith(expect.stringContaining('FORBIDDEN'));
  });
  it('lists enriched devices, individual detail and recent activity for an authenticated user', async () => {
    const device = {
      id: 'dev-1', homeId: 'home-1', roomId: null, externalId: 'ha:light.sala', name: 'Sala', type: 'light',
      vendor: 'Home Assistant', status: 'ASSIGNED', integrationSource: 'home-assistant', invertState: false,
      lastKnownState: { state: 'on' }, entityVersion: 1, createdAt: '', updatedAt: '',
    } as Device;
    mockDeviceRepository.findAllOrderedByStatus.mockResolvedValue([device]);
    mockDeviceRepository.findDeviceById.mockResolvedValue(device);
    (mockContainer.repositories as any).activityLogRepository = {
      findRecentByDeviceId: jest.fn().mockResolvedValue([{ id: 'log-1' }]),
      findAllRecent: jest.fn().mockResolvedValue([{ id: 'log-2' }]),
    };
    const listResponse = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };
    const detailResponse = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };
    const activityResponse = { writeHead: jest.fn().mockReturnThis(), end: jest.fn(), setHeader: jest.fn() };

    await routes.handle(mockReq as HomePilotRequest, listResponse as any, '/api/v1/devices', 'GET', mockContainer as BootstrapContainer);
    await routes.handle(mockReq as HomePilotRequest, detailResponse as any, '/api/v1/devices/dev-1', 'GET', mockContainer as BootstrapContainer);
    await routes.handle(mockReq as HomePilotRequest, activityResponse as any, '/api/v1/devices/dev-1/activity-logs', 'GET', mockContainer as BootstrapContainer);

    expect(listResponse.end).toHaveBeenCalledWith(expect.stringContaining('"dev-1"'));
    expect(detailResponse.end).toHaveBeenCalledWith(expect.stringContaining('"profile"'));
    expect(activityResponse.end).toHaveBeenCalledWith(expect.stringContaining('"log-1"'));
  });
});
