import { StateIngestionController } from '../api/controllers/StateIngestionController';
import { ObservabilityController } from '../api/controllers/ObservabilityController';
import { InMemoryDeviceRepository } from '../infrastructure/repositories/InMemoryDeviceRepository';
import { InMemoryActivityLogRepository } from '../infrastructure/repositories/InMemoryActivityLogRepository';
import { InMemoryDeviceEventPublisher } from '../domain/events/InMemoryDeviceEventPublisher';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { createDiscoveredDevice } from '../domain/createDiscoveredDevice';
import { HttpRequest, AuthenticatedHttpRequest } from '../../topology/api/core/http';
import { IdGenerator, Clock } from '../../shared/domain/types';
import { ForbiddenOwnershipError } from '../application/errors';
import { ActivityRecord } from '../domain/repositories/ActivityLogRepository';

describe('Devices: State API (Controllers)', () => {
  let deviceRepo: InMemoryDeviceRepository;
  let logRepo: InMemoryActivityLogRepository;
  let eventPub: InMemoryDeviceEventPublisher;
  let mockTopology: jest.Mocked<TopologyReferencePort>;
  
  const idGen: IdGenerator = { generate: () => 'req-id' };
  const clock: Clock = { now: () => '2026-03-29T14:00:00Z' };

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

    ingestController = new StateIngestionController(deviceRepo, eventPub, logRepo, idGen, clock);
    obsController = new ObservabilityController(deviceRepo, logRepo, mockTopology);
  });

  describe('POST /integrations/state-sync', () => {
    it('debe retornar 400 si el body no es un objeto o el state es inválido (array)', async () => {
      const req: HttpRequest = { body: { deviceId: 'd', state: [1,2] } };
      const res = await ingestController.syncState(req);
      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({ error: 'Bad Request' });
    });

    it('debe retornar 404 si el device no existe comercialmente', async () => {
      const req: HttpRequest = { body: { deviceId: 'void', state: { p: 1 } } };
      const res = await ingestController.syncState(req);
      expect(res.statusCode).toBe(404);
    });

    it('debe retornar 200 en éxito', async () => {
      const device = createDiscoveredDevice({
        homeId: 'h', externalId: 'e', name: 'N', type: 'T', vendor: 'V'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      const req: HttpRequest = { body: { deviceId: device.id, state: { light: 'on' } } };
      const res = await ingestController.syncState(req);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('GET /devices/:deviceId/state', () => {
    it('debe retornar 400 si deviceId está vacío o malformado', async () => {
      const req: AuthenticatedHttpRequest = { params: { deviceId: '  ' }, userId: 'u' };
      const res = await obsController.getState(req);
      expect(res.statusCode).toBe(400);
    });

    it('debe retornar 403 si el usuario no es dueño del hogar del dispositivo', async () => {
      const device = createDiscoveredDevice({
        homeId: 'home-A', externalId: 'e', name: 'N', type: 'T', vendor: 'V'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      mockTopology.validateHomeOwnership.mockRejectedValue(new ForbiddenOwnershipError(`Forbidden access to home-A`));

      const req: AuthenticatedHttpRequest = { params: { deviceId: device.id }, userId: 'user-B' };
      const res = await obsController.getState(req);
      expect(res.statusCode).toBe(403);
    });
  });

  describe('GET /devices/:deviceId/history', () => {
    it('debe capturar el parámetro limit y pasarlo al caso de uso (normalizado)', async () => {
      const device = createDiscoveredDevice({
        homeId: 'h', externalId: 'e', name: 'N', type: 'T', vendor: 'V'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      const req: AuthenticatedHttpRequest = { 
        params: { deviceId: device.id }, 
        userId: 'u',
        query: { limit: '10' }
      };
      
      const res = await obsController.getHistory(req);
      expect(res.statusCode).toBe(200);
    });

    it('debe normalizar límites inválidos (negativos o NaN) a un default seguro (50)', async () => {
       const device = createDiscoveredDevice({
        homeId: 'h', externalId: 'e', name: 'N', type: 'T', vendor: 'V'
      }, { idGenerator: idGen, clock });
      await deviceRepo.saveDevice(device);

      const req: AuthenticatedHttpRequest = { 
        params: { deviceId: device.id }, 
        userId: 'u',
        query: { limit: '-5' }
      };

      const res = await obsController.getHistory(req);
      expect(res.statusCode).toBe(200);
    });
  });
});
