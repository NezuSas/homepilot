import { executeDeviceCommandUseCase } from '../application/executeDeviceCommandUseCase';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { UnsupportedCommandError, Device } from '../domain';
import { IdGenerator, Clock } from '../../shared/domain/types';

describe('Devices: Capabilities Application Guard', () => {
  let deviceRepo: InMemoryDeviceRepository;
  let eventPub: InMemoryDeviceEventPublisher;
  let logRepo: InMemoryActivityLogRepository;
  let mockTopology: jest.Mocked<TopologyReferencePort>;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;

  const idGen: IdGenerator = { generate: () => 'id-123' };
  const clock: Clock = { now: () => '2026-03-29T16:00:00Z' };

  beforeEach(() => {
    deviceRepo = new InMemoryDeviceRepository();
    eventPub = new InMemoryDeviceEventPublisher();
    logRepo = new InMemoryActivityLogRepository();
    
    mockTopology = { 
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };

    mockDispatcher = { 
      dispatch: jest.fn().mockResolvedValue(undefined) 
    };
  });

  const deviceBase: Device = {
    id: 'd1', 
    homeId: 'h1', 
    externalId: 'ext-1',
    name: 'N', 
    vendor: 'V',
    type: 'switch',
    entityVersion: 1, 
    createdAt: 'x', 
    updatedAt: 'x', 
    roomId: 'r1', 
    status: 'ASSIGNED', 
    lastKnownState: null
  };

  it('debe lanzar UnsupportedCommandError y NO tocar dispatcher ante comando incompatible', async () => {
    await deviceRepo.saveDevice({ ...deviceBase, type: 'sensor' });

    await expect(executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: deviceRepo,
      eventPublisher: eventPub,
      topologyPort: mockTopology,
      dispatcherPort: mockDispatcher,
      activityLogRepository: logRepo,
      idGenerator: idGen,
      clock
    })).rejects.toThrow(UnsupportedCommandError);

    expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    expect(eventPub.getEvents()).toHaveLength(0);
    expect(await logRepo.findRecentByDeviceId('d1', 10)).toHaveLength(0);
  });

  it('debe permitir el paso si el comando es compatible', async () => {
    await deviceRepo.saveDevice({ ...deviceBase, type: 'light' });

    await executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: deviceRepo,
      eventPublisher: eventPub,
      topologyPort: mockTopology,
      dispatcherPort: mockDispatcher,
      activityLogRepository: logRepo,
      idGenerator: idGen,
      clock
    });

    expect(mockDispatcher.dispatch).toHaveBeenCalledWith('d1', 'turn_on');
    expect(await logRepo.findRecentByDeviceId('d1', 10)).toHaveLength(1);
  });
});
