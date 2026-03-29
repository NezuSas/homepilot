import { StateIngestionController } from '../api/controllers/StateIngestionController';
import { ObservabilityController } from '../api/controllers/ObservabilityController';
import { executeDeviceCommandUseCase } from '../application/executeDeviceCommandUseCase';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { DeviceCommandDispatcherPort } from '../application/ports/DeviceCommandDispatcherPort';
import { HttpRequest, AuthenticatedHttpRequest } from '../../topology/api/core/http';
import { IdGenerator, Clock } from '../../shared/domain/types';
import { ForbiddenOwnershipError } from '../application/errors';
import { ActivityRecord } from '../domain/repositories/ActivityLogRepository';

/**
 * Suite E2E validando los Acceptance Criteria (AC) del spec:
 * "Sincronización de estado de dispositivos y observabilidad básica"
 */
describe('Devices: State Synchronization & Observability E2E (Acceptance Criteria)', () => {
  let deviceRepo: InMemoryDeviceRepository;
  let logRepo: InMemoryActivityLogRepository;
  let eventPub: InMemoryDeviceEventPublisher;
  let mockTopology: jest.Mocked<TopologyReferencePort>;
  let mockDispatcher: jest.Mocked<DeviceCommandDispatcherPort>;
  
  const idGen: IdGenerator = { generate: () => 'id-123' };
  const clock: Clock = { now: () => '2026-03-29T15:00:00Z' };

  let ingestController: StateIngestionController;
  let obsController: ObservabilityController;

  beforeEach(() => {
    deviceRepo = new InMemoryDeviceRepository();
    logRepo = new InMemoryActivityLogRepository();
    eventPub = new InMemoryDeviceEventPublisher();
    mockTopology = { 
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<TopologyReferencePort>;
    mockDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };

    ingestController = new StateIngestionController(deviceRepo, eventPub, logRepo, idGen, clock);
    obsController = new ObservabilityController(deviceRepo, logRepo, mockTopology);
  });

  test('AC1: Ingesta Exitosa - Cambio de estado actualiza snapshot, versión y emite evento', async () => {
    const device = createDiscoveredDevice({
      homeId: 'home-1', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
    }, { idGenerator: idGen, clock });
    await deviceRepo.saveDevice(device);

    const req: HttpRequest = { body: { deviceId: device.id, state: { level: 50 } } };
    const res = await ingestController.syncState(req);
    expect(res.statusCode).toBe(200);

    const updated = await deviceRepo.findDeviceById(device.id);
    expect(updated?.lastKnownState).toEqual({ level: 50 });
    expect(updated?.entityVersion).toBe(2);
    
    const events = eventPub.getEvents();
    expect(events.some(e => e.eventType === 'DeviceStateUpdatedEvent')).toBe(true);
  });

  test('AC2: Deduplicación Silenciosa - Estado idéntico no cambia nada', async () => {
    const device = { ...createDiscoveredDevice({
      homeId: 'home-1', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
    }, { idGenerator: idGen, clock }), lastKnownState: { level: 50 }, entityVersion: 5 };
    await deviceRepo.saveDevice(device);

    const req: HttpRequest = { body: { deviceId: device.id, state: { level: 50 } } };
    const res = await ingestController.syncState(req);
    expect(res.statusCode).toBe(200);

    const after = await deviceRepo.findDeviceById(device.id);
    expect(after?.entityVersion).toBe(5); // Sin incremento
    expect(eventPub.getEvents()).toHaveLength(0); // Sin eventos
    expect(await logRepo.findRecentByDeviceId(device.id, 10)).toHaveLength(0); // Sin logs
  });

  test('AC3: Seguridad Zero-Trust - Usuario ajeno recibe 403 Forbidden', async () => {
    const device = createDiscoveredDevice({
      homeId: 'home-owner', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
    }, { idGenerator: idGen, clock });
    await deviceRepo.saveDevice(device);

    // Simulamos que topology port rechaza al intruso
    mockTopology.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError(`Forbidden access to home-owner`));

    const req: AuthenticatedHttpRequest = { params: { deviceId: device.id }, userId: 'intruder' };
    const res = await obsController.getState(req);
    expect(res.statusCode).toBe(403);
  });

  test('AC4: Historial Combinado - /history muestra comandos y estados en orden cronológico correcto', async () => {
    const device = { ...createDiscoveredDevice({
      homeId: 'home-1', externalId: 'ext-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
    }, { idGenerator: idGen, clock }), roomId: 'room-1', status: 'ASSIGNED' as const };
    await deviceRepo.saveDevice(device);

    // 1. Enviamos comando
    await executeDeviceCommandUseCase(device.id, 'turn_on', 'user-1', 'c1', {
      deviceRepository: deviceRepo, eventPublisher: eventPub, topologyPort: mockTopology,
      dispatcherPort: mockDispatcher, activityLogRepository: logRepo, idGenerator: idGen, clock
    });

    // 2. Sincronizamos estado
    const syncReq: HttpRequest = { body: { deviceId: device.id, state: { power: 'on' } } };
    await ingestController.syncState(syncReq);

    const historyReq: AuthenticatedHttpRequest = { params: { deviceId: device.id }, userId: 'user-1' };
    const res = await obsController.getHistory(historyReq);
    const history = res.body as ReadonlyArray<ActivityRecord>;

    expect(history).toHaveLength(2);
    expect(history[0].type).toBe('STATE_CHANGED');      // El más reciente (LIFO)
    expect(history[1].type).toBe('COMMAND_DISPATCHED'); // El primero
  });

  test('AC5: Visibilidad en Inbox - Dueño puede consultar /state de un device en PENDING', async () => {
    const device = createDiscoveredDevice({
      homeId: 'home-1', externalId: 'inbox-1', name: 'Bulb', type: 'light', vendor: 'Pilot'
    }, { idGenerator: idGen, clock });
    // Dispositivo sigue en PENDING (le acabamos de reportar un estado inicial)
    const withState = { ...device, lastKnownState: { paired: true } };
    await deviceRepo.saveDevice(withState);

    const req: AuthenticatedHttpRequest = { params: { deviceId: device.id }, userId: 'owner' };
    const res = await obsController.getState(req);
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ paired: true });
    expect(mockTopology.validateHomeOwnership).toHaveBeenCalledWith('home-1', 'owner');
  });
});
