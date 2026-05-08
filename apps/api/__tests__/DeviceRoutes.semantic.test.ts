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

    routes = new DeviceRoutes('test.db');

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
});

