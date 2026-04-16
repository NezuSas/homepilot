import { executeDeviceCommandUseCase } from '../application/executeDeviceCommandUseCase';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { Device } from '../domain';
import { InMemoryDeviceCommandDispatcher } from '../infrastructure/adapters/InMemoryDeviceCommandDispatcher';
import { 
  DeviceNotFoundError, 
  DevicePendingStateError, 
  DispatchIntegrationError 
} from '../application/errors';
import { InvalidDeviceCommandError } from '../domain/errors';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';

describe('Módulo Devices - Pruebas de Comando (Aplicación)', () => {
  let repo: InMemoryDeviceRepository;
  let log: InMemoryActivityLogRepository;
  let publisher: InMemoryDeviceEventPublisher;
  let dispatcher: InMemoryDeviceCommandDispatcher;
  let topologyPort: TopologyReferencePort;
  
  const mockDeps = {
    idGenerator: { generate: () => 'event-id' },
    clock: { now: () => '2026-01-01T00:00:00Z' }
  };

  beforeEach(() => {
    repo = new InMemoryDeviceRepository();
    log = new InMemoryActivityLogRepository();
    publisher = new InMemoryDeviceEventPublisher();
    dispatcher = new InMemoryDeviceCommandDispatcher();
    topologyPort = {
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
  });

  const deviceBase: Device = {
    id: 'd1', homeId: 'h1', externalId: 'ex', name: 'n', type: 'switch', vendor: 'v',
    status: 'ASSIGNED', integrationSource: 'ha', invertState: false,
    lastKnownState: null, entityVersion: 1, createdAt: 'x', updatedAt: 'x', roomId: 'r1'
  };

  it('debe lanzar DeviceNotFoundError si el dispositivo no existe en el repositorio', async () => {
    await expect(executeDeviceCommandUseCase('missing', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisher, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    })).rejects.toThrow(DeviceNotFoundError);
  });

  it('debe lanzar DevicePendingStateError (409) si el dispositivo está en estado PENDING', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'PENDING', roomId: null });
    
    await expect(executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisher, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    })).rejects.toThrow(DevicePendingStateError);
  });

  it('debe lanzar InvalidDeviceCommandError (400) si el comando no pertenece al diccionario V1', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    
    await expect(executeDeviceCommandUseCase('d1', 'invalid_cmd', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisher, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    })).rejects.toThrow(InvalidDeviceCommandError);
  });

  it('debe despachar exitosamente, emitir evento Dispatched y no mutar la entidad', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    
    await executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisher, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    });
    
    const events = publisher.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('DeviceCommandDispatchedEvent');
    
    // Verificar que el dispositivo no cambió (sin incremento de version)
    const deviceAfter = await repo.findDeviceById('d1');
    expect(deviceAfter?.entityVersion).toBe(1);
  });

  it('debe lanzar DispatchIntegrationError (502) y emitir evento Failed si el dispatcher físico falla', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    dispatcher.forceFailureSimulation(true);
    
    await expect(executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisher, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    })).rejects.toThrow(DispatchIntegrationError);
    
    const events = publisher.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('DeviceCommandFailedEvent');
  });

  it('debe resolver exitosamente aunque la publicación del evento de éxito (Best-effort) falle', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    
    // Forzamos fallo en el publisher
    const publisherWithFailure = new InMemoryDeviceEventPublisher();
    publisherWithFailure.publish = jest.fn().mockRejectedValue(new Error('Event Store Down'));

    await executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisherWithFailure, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    });
    
    // El caso de uso no debe haber lanzado error pese al fallo del publisher
    expect(true).toBe(true);
  });

  it('debe lanzar DispatchIntegrationError aunque la publicación del evento de fallo también falle', async () => {
    await repo.saveDevice({ ...deviceBase, status: 'ASSIGNED', roomId: 'r1' });
    dispatcher.forceFailureSimulation(true);
    
    // Forzamos fallo en el publisher
    const publisherWithFailure = new InMemoryDeviceEventPublisher();
    publisherWithFailure.publish = jest.fn().mockRejectedValue(new Error('Event Store Down'));

    await expect(executeDeviceCommandUseCase('d1', 'turn_on', 'u1', 'c1', {
      deviceRepository: repo, eventPublisher: publisherWithFailure, topologyPort, dispatcherPort: dispatcher, activityLogRepository: log, ...mockDeps
    })).rejects.toThrow(DispatchIntegrationError);
  });
});
