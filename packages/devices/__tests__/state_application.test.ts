import { syncDeviceStateUseCase } from '../application/syncDeviceStateUseCase';
import { getDeviceStateUseCase } from '../application/getDeviceStateUseCase';
import { getDeviceActivityHistoryUseCase } from '../application/getDeviceActivityHistoryUseCase';
import { executeDeviceCommandUseCase } from '../application/executeDeviceCommandUseCase';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { DeviceNotFoundError, ForbiddenOwnershipError } from '../application/errors';
import { IdGenerator, Clock } from '../../shared/domain/types';

describe('Devices: State Application', () => {
  let deviceRepo: InMemoryDeviceRepository;
  let logRepo: InMemoryActivityLogRepository;
  let eventPub: InMemoryDeviceEventPublisher;
  let mockTopology: jest.Mocked<TopologyReferencePort>;
  
  const idGen: IdGenerator = { generate: () => 'event-123' };
  const clock: Clock = { now: () => '2026-03-29T13:00:00Z' };

  beforeEach(() => {
    deviceRepo = new InMemoryDeviceRepository();
    logRepo = new InMemoryActivityLogRepository();
    eventPub = new InMemoryDeviceEventPublisher();
    mockTopology = {
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined)
    } as any;
  });

  describe('syncDeviceStateUseCase', () => {
    it('debe actualizar el estado, versión y registrar actividad cuando el estado cambia', async () => {
      const device = createDiscoveredDevice({
        homeId: 'home-1', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      await syncDeviceStateUseCase(device.id, { power: 'on' }, 'corr-1', {
        deviceRepository: deviceRepo,
        eventPublisher: eventPub,
        activityLogRepository: logRepo,
        idGenerator: idGen,
        clock
      });

      const updated = await deviceRepo.findDeviceById(device.id);
      expect(updated?.lastKnownState).toEqual({ power: 'on' });
      expect(updated?.entityVersion).toBe(2);
      
      const logs = await logRepo.findRecentByDeviceId(device.id, 10);
      expect(logs[0].type).toBe('STATE_CHANGED');
      
      const events = eventPub.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('DeviceStateUpdatedEvent');
    });

    it('IDEMPOTENCIA: no debe realizar cambios si el estado reportado es idéntico al actual', async () => {
      const device = createDiscoveredDevice({
        homeId: 'home-1', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
      }, { idGenerator: idGen, clock });
      // Seteamos estado inicial
      const withState = { ...device, lastKnownState: { power: 'on' }, entityVersion: 10 };
      await deviceRepo.saveDevice(withState);

      await syncDeviceStateUseCase(device.id, { power: 'on' }, 'corr-2', {
        deviceRepository: deviceRepo,
        eventPublisher: eventPub,
        activityLogRepository: logRepo,
        idGenerator: idGen,
        clock
      });

      const afterSync = await deviceRepo.findDeviceById(device.id);
      expect(afterSync?.entityVersion).toBe(10); // No incrementó
      expect(eventPub.getEvents()).toHaveLength(0); // No emitió
      expect(await logRepo.findRecentByDeviceId(device.id, 10)).toHaveLength(0); // No registró log
    });

    it('debe lanzar DeviceNotFoundError si el dispositivo no existe', async () => {
      await expect(syncDeviceStateUseCase('void', {}, 'c', { 
        deviceRepository: deviceRepo, eventPublisher: eventPub, activityLogRepository: logRepo, idGenerator: idGen, clock 
      })).rejects.toThrow(DeviceNotFoundError);
    });
  });

  describe('getDeviceStateUseCase', () => {
    it('debe retornar el estado tras validar ownership exitoso', async () => {
      const device = { ...createDiscoveredDevice({
        homeId: 'home-1', externalId: 'ext-1', name: 'X', type: 'Y', vendor: 'Z'
      }, { idGenerator: idGen, clock }), lastKnownState: { temp: 22 } };
      await deviceRepo.saveDevice(device);

      const state = await getDeviceStateUseCase(device.id, 'user-1', {
        deviceRepository: deviceRepo,
        topologyPort: mockTopology
      });

      expect(state).toEqual({ temp: 22 });
      expect(mockTopology.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'user-1');
    });

    it('debe lanzar ForbiddenOwnershipError si el usuario no es dueño', async () => {
      const device = createDiscoveredDevice({
        homeId: 'home-1', externalId: 'ext-1', name: 'X', type: 'Y', vendor: 'Z'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      mockTopology.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError(`Forbidden access to home-1`));

      await expect(getDeviceStateUseCase(device.id, 'user-evil', {
        deviceRepository: deviceRepo,
        topologyPort: mockTopology
      })).rejects.toThrow(ForbiddenOwnershipError);
    });
  });

  describe('Integración de Observability en executeDeviceCommandUseCase', () => {
    it('debe registrar COMMAND_DISPATCHED en el historial tras un despacho exitoso', async () => {
      const device = { ...createDiscoveredDevice({
        homeId: 'home-1', externalId: 'ext-1', name: 'X', type: 'light', vendor: 'Z'
      }, { idGenerator: idGen, clock }), roomId: 'room-1', status: 'ASSIGNED' as const };
      await deviceRepo.saveDevice(device);

      const mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

      await executeDeviceCommandUseCase(device.id, 'turn_on', 'user-1', 'corr-cmds', {
        deviceRepository: deviceRepo,
        eventPublisher: eventPub,
        topologyPort: mockTopology,
        dispatcherPort: mockDispatcher,
        activityLogRepository: logRepo,
        idGenerator: idGen,
        clock
      });

      const logs = await logRepo.findRecentByDeviceId(device.id, 10);
      expect(logs).toHaveLength(1);
      expect(logs[0].type).toBe('COMMAND_DISPATCHED');
    });
  });
});
