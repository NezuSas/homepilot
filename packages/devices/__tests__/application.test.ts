import { discoverDeviceUseCase, listPendingInboxUseCase, assignDeviceUseCase } from '../application';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { DeviceConflictError, ForbiddenOwnershipError, TopologyResourceNotFoundError } from '../application/errors';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';

describe('Módulo Devices - Capa de Aplicación', () => {
  let repo: InMemoryDeviceRepository;
  let publisher: InMemoryDeviceEventPublisher;
  let topologyPort: TopologyReferencePort;
  const mockDeps = {
    idGenerator: { generate: () => 'mock-id' },
    clock: { now: () => 'mock-time' }
  };

  beforeEach(() => {
    repo = new InMemoryDeviceRepository();
    publisher = new InMemoryDeviceEventPublisher();
    topologyPort = {
      validateHomeExists: jest.fn().mockResolvedValue(undefined),
      validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
      validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
    };
  });

  describe('discoverDeviceUseCase', () => {
    it('debe invocar la validación genérica de existencia topológica e ingerir la creación determinista manejando límites M2M con seguridad', async () => {
      const device = await discoverDeviceUseCase('h1', 'ext1', 'sensor', 't', 'v', 'corr1', {
        deviceRepository: repo, eventPublisher: publisher, topologyPort, ...mockDeps
      });
      expect(device.id).toBe('mock-id');
      expect(topologyPort.validateHomeExists).toHaveBeenCalledWith('h1');
      expect(publisher.getEvents().length).toBe(1);
    });

    it('debe interrumpir el flujo lazando un DeviceConflictError (409) explícito asumiendo colisión si existe un duplicado mapeado', async () => {
      await repo.saveDevice({ id: 'd1', homeId: 'h1', externalId: 'ext1', roomId: null, status: 'PENDING', name: 'n', type: 't', vendor: 'v', entityVersion: 1, createdAt: 'x', updatedAt: 'x' });
      
      await expect(discoverDeviceUseCase('h1', 'ext1', 'sensor', 't', 'v', 'corr1', {
        deviceRepository: repo, eventPublisher: publisher, topologyPort, ...mockDeps
      })).rejects.toThrow(DeviceConflictError);
    });
  });

  describe('listPendingInboxUseCase', () => {
    it('debe autenticar firmemente el ownership contra el contexto externo (Topología) y retornar el Inbox seguro filtrado', async () => {
      await repo.saveDevice({ id: 'd1', homeId: 'h1', externalId: 'ext1', roomId: null, status: 'PENDING', name: 'n', type: 't', vendor: 'v', entityVersion: 1, createdAt: 'x', updatedAt: 'x' });
      
      const inbox = await listPendingInboxUseCase('h1', 'user1', { deviceRepository: repo, topologyPort });
      
      expect(topologyPort.validateHomeOwnership).toHaveBeenCalledWith('h1', 'user1');
      expect(inbox.length).toBe(1);
    });

    it('debe desacoplar brutalmente las consultas arrojando una excepción explícita si el puerto de Topología deniega el acceso (403)', async () => {
      topologyPort.validateHomeOwnership = jest.fn().mockRejectedValue(new ForbiddenOwnershipError('denied'));
      
      await expect(listPendingInboxUseCase('h1', 'user1', { deviceRepository: repo, topologyPort }))
        .rejects.toThrow(ForbiddenOwnershipError);
    });
  });

  describe('assignDeviceUseCase', () => {
    it('debe interceptar la operación validando estrictamente las intersecciones de dominio para prevenir cruces arbitrarios de Rooms e inyectar mutación segura', async () => {
      await repo.saveDevice({ id: 'd1', homeId: 'h1', externalId: 'ext1', roomId: null, status: 'PENDING', name: 'n', type: 't', vendor: 'v', entityVersion: 1, createdAt: 'x', updatedAt: 'x' });
      
      const updated = await assignDeviceUseCase('d1', 'r1', 'user1', 'corr1', {
        deviceRepository: repo, eventPublisher: publisher, topologyPort, ...mockDeps
      });
      
      expect(topologyPort.validateHomeOwnership).toHaveBeenCalledWith('h1', 'user1');
      expect(topologyPort.validateRoomBelongsToHome).toHaveBeenCalledWith('r1', 'h1');
      expect(updated.status).toBe('ASSIGNED');
    });
  });
});
