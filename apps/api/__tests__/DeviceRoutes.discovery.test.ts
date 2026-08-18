import * as http from 'http';
import type { BootstrapContainer } from '../../../bootstrap';
import type { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { Device } from '../../../packages/devices/domain/types';

const discoverDeviceUseCase = jest.fn();

jest.mock('../../../packages/devices/application/discoverDeviceUseCase', () => ({ discoverDeviceUseCase }));

import { DeviceRoutes } from '../routes/DeviceRoutes';

const discoveredDevice: Device = {
  id: 'device-1', homeId: 'home-1', roomId: null, externalId: 'edge:lamp-1', name: 'Desk lamp', type: 'light', vendor: 'Edge', status: 'PENDING', integrationSource: 'native', invertState: false, lastKnownState: null, entityVersion: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
};

function response(): http.ServerResponse {
  return { writeHead: jest.fn().mockReturnThis(), end: jest.fn().mockReturnThis() } as unknown as http.ServerResponse;
}

function request(payload: unknown, key = 'edge-secret'): HomePilotRequest {
  return { headers: { 'x-homepilot-integration-key': key }, _fastifyParsedBody: JSON.stringify(payload) } as unknown as HomePilotRequest;
}

function container(): BootstrapContainer {
  return {
    repositories: { deviceRepository: {} },
    adapters: { deviceEventPublisher: {}, topologyReferencePort: {} },
  } as unknown as BootstrapContainer;
}

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'constructor', { value: { name } });
  return error;
}

describe('Feature: integration discovery route contracts', () => {
  const previousKey = process.env.HOMEPILOT_INTEGRATION_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HOMEPILOT_INTEGRATION_API_KEY = 'edge-secret';
  });

  afterAll(() => {
    if (previousKey === undefined) delete process.env.HOMEPILOT_INTEGRATION_API_KEY;
    else process.env.HOMEPILOT_INTEGRATION_API_KEY = previousKey;
  });

  it.each([
    ['missing key', undefined],
    ['wrong key', 'other-secret'],
    ['wrong-length key', 'short'],
  ])('rejects discovery with a %s before parsing or executing it', async (_label, key) => {
    const res = response();
    const req = key === undefined
      ? ({ headers: {}, _fastifyParsedBody: JSON.stringify({}) } as unknown as HomePilotRequest)
      : request({}, key);

    await new DeviceRoutes().handle(req, res, '/api/v1/integrations/discovery', 'POST', container());

    expect(discoverDeviceUseCase).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('UNAUTHORIZED'));
  });

  it('uses the first integration key header value when the HTTP runtime provides an array', async () => {
    discoverDeviceUseCase.mockResolvedValue(discoveredDevice);
    const res = response();
    const req = {
      headers: { 'x-homepilot-integration-key': ['edge-secret', 'ignored'] },
      _fastifyParsedBody: JSON.stringify({ homeId: 'home-1', externalId: 'lamp-1', name: 'Desk lamp', type: 'light', vendor: 'Edge' }),
    } as unknown as HomePilotRequest;

    await new DeviceRoutes().handle(req, res, '/api/v1/integrations/discovery', 'POST', container());

    expect(discoverDeviceUseCase).toHaveBeenCalledTimes(1);
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
  });
  it('rejects an incomplete discovery payload before invoking the domain use case', async () => {
    const res = response();
    await new DeviceRoutes().handle(request({ homeId: 'home-1', externalId: 'lamp-1', name: 'Lamp', type: 'light' }), res, '/api/v1/integrations/discovery', 'POST', container());

    expect(discoverDeviceUseCase).not.toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('VALIDATION_ERROR'));
  });

  it('creates a validated discovery using the m2m integration key', async () => {
    discoverDeviceUseCase.mockResolvedValue(discoveredDevice);
    const res = response();

    await new DeviceRoutes().handle(request({ homeId: 'home-1', externalId: 'lamp-1', name: 'Desk lamp', type: 'light', vendor: 'Edge' }), res, '/api/v1/integrations/discovery', 'POST', container());

    expect(discoverDeviceUseCase).toHaveBeenCalledWith('home-1', 'lamp-1', 'Desk lamp', 'light', 'Edge', expect.any(String), expect.any(Object));
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Desk lamp'));
  });

  it.each([
    ['DeviceConflictError', 409, 'DEVICE_ALREADY_EXISTS'],
    ['TopologyResourceNotFoundError', 404, 'HOME_NOT_FOUND'],
    ['UnexpectedStorageError', 500, 'INTERNAL_ERROR'],
  ])('maps %s to its stable discovery error contract', async (errorName, status, code) => {
    discoverDeviceUseCase.mockRejectedValue(namedError(errorName, 'discovery failed'));
    const res = response();

    await new DeviceRoutes().handle(request({ homeId: 'home-1', externalId: 'lamp-1', name: 'Desk lamp', type: 'light', vendor: 'Edge' }), res, '/api/v1/integrations/discovery', 'POST', container());

    expect(res.writeHead).toHaveBeenCalledWith(status, expect.any(Object));
    expect(res.end).toHaveBeenCalledWith(expect.stringContaining(code));
  });
});