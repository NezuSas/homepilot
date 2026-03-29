import { CommandController } from '../api/controllers/CommandController';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { ForbiddenOwnershipError } from '../application/errors';
import { AuthenticatedHttpRequest } from '../../topology/api/core/http';
import { Device } from '../domain';
import { IdGenerator, Clock } from '../../shared/domain/types';

describe('Devices: Capabilities & Validation E2E (Acceptance Criteria)', () => {
  let repo: InMemoryDeviceRepository;
  let pub: InMemoryDeviceEventPublisher;
  let log: InMemoryActivityLogRepository;
  let mockTopo: jest.Mocked<TopologyReferencePort>;
  let mockDisp: jest.Mocked<DeviceCommandDispatcherPort>;
  const idGen = { generate: () => 'id-123' };
  const clock: Clock = { now: () => '2026-03-29T17:00:00Z' };

  let controller: CommandController;

  beforeEach(() => {
    repo = new InMemoryDeviceRepository();
    pub = new InMemoryDeviceEventPublisher();
    log = new InMemoryActivityLogRepository();
    
    mockTopo = { 
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    mockDisp = { 
      dispatch: jest.fn().mockResolvedValue(undefined) 
    };

    controller = new CommandController(repo, pub, mockTopo, mockDisp, log, idGen, clock);
  });

  test('AC1: Dispositivo tipo light acepta comando toggle', async () => {
    const rawDevice = createDiscoveredDevice({
      homeId: 'h1', externalId: 'e1', name: 'Light', type: 'light', vendor: 'V'
    }, { idGenerator: idGen, clock });

    const device: Device = { 
      ...rawDevice, 
      status: 'ASSIGNED', 
      roomId: 'r1' 
    };
    await repo.saveDevice(device);

    const req: AuthenticatedHttpRequest = {
      params: { deviceId: device.id },
      body: { command: 'toggle' },
      userId: 'user1',
      headers: {}
    } as AuthenticatedHttpRequest;

    const res = await controller.executeCommand(req);
    expect(res.statusCode).toBe(202);
    expect(mockDisp.dispatch).toHaveBeenCalledWith(device.id, 'toggle');
  });

  test('AC2: Dispositivo tipo sensor rechaza turn_on con 400', async () => {
    const rawDevice = createDiscoveredDevice({
      homeId: 'h1', externalId: 'e2', name: 'Temp', type: 'sensor', vendor: 'V'
    }, { idGenerator: idGen, clock });

    const device: Device = { 
      ...rawDevice, 
      status: 'ASSIGNED', 
      roomId: 'r1' 
    };
    await repo.saveDevice(device);

    const req: AuthenticatedHttpRequest = {
      params: { deviceId: device.id },
      body: { command: 'turn_on' },
      userId: 'user1',
      headers: {}
    } as AuthenticatedHttpRequest;

    const res = await controller.executeCommand(req);
    expect(res.statusCode).toBe(400);

    if (res.body && typeof res.body === 'object' && 'message' in res.body) {
      expect((res.body as { message: string }).message).toContain('not supported');
    } else {
      throw new Error('Response body should contain a message');
    }
  });

  test('AC3: Validación de capacidad ocurre después de Zero-Trust pero antes de dispatch', async () => {
    const rawDevice = createDiscoveredDevice({
      homeId: 'home-A', externalId: 'e1', name: 'N', type: 'sensor', vendor: 'V'
    }, { idGenerator: idGen, clock });

    const device: Device = { ...rawDevice, status: 'ASSIGNED' };
    await repo.saveDevice(device);

    // Si falla ownership, debe dar 403 antes que 400 por capacidad
    mockTopo.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError('Acceso denegado'));

    const req: AuthenticatedHttpRequest = {
      params: { deviceId: device.id },
      body: { command: 'turn_on' },
      userId: 'intruder',
      headers: {}
    } as AuthenticatedHttpRequest;

    const res = await controller.executeCommand(req);
    
    expect(res.statusCode).toBe(403);

    if (res.body && typeof res.body === 'object' && 'error' in res.body) {
      expect((res.body as { error: string }).error).toBe('Forbidden');
    } else {
      throw new Error('Response should contain an error field');
    }

    expect(mockDisp.dispatch).not.toHaveBeenCalled();
  });

  test('AC4: Un rechazo por capacidad no ensucia ActivityLog', async () => {
    const rawDevice = createDiscoveredDevice({
      homeId: 'h1', externalId: 'e2', name: 'Temp', type: 'sensor', vendor: 'V'
    }, { idGenerator: idGen, clock });

    const device: Device = { 
      ...rawDevice, 
      status: 'ASSIGNED', 
      roomId: 'r1' 
    };
    await repo.saveDevice(device);

    const req: AuthenticatedHttpRequest = {
      params: { deviceId: device.id },
      body: { command: 'turn_on' },
      userId: 'user1',
      headers: {}
    } as AuthenticatedHttpRequest;

    await controller.executeCommand(req);

    const activity = await log.findRecentByDeviceId(device.id, 10);
    expect(activity).toHaveLength(0);
    expect(mockDisp.dispatch).not.toHaveBeenCalled();
  });
});
