import { handleError, IntegrationsController, InboxController, DeviceController } from '../api';
import { DeviceConflictError, TopologyResourceNotFoundError, ForbiddenOwnershipError } from '../application/errors';
import { InvalidDeviceNameError } from '../domain/errors';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { HttpRequest, AuthenticatedHttpRequest } from '../../topology/api/core/http';

describe('Devices API Layer', () => {

  describe('Standard HTTP Mapper (errorHandler)', () => {
    it('maps native transactional DeviceConflictError natively targeting 409 responses decoupled from Framework constraints', () => {
      const error = new DeviceConflictError('ext1', 'h1');
      const response = handleError(error);
      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ error: 'Conflict', message: error.message });
    });

    it('translates logical external TopologyResourceNotFoundError precisely matching strict RESTful definitions intercepting external 404', () => {
      const error = new TopologyResourceNotFoundError('Home', 'h1');
      const response = handleError(error);
      expect(response.statusCode).toBe(404);
    });

    it('extracts security violation properties correctly yielding explicit HTTP 403 blocks', () => {
      const error = new ForbiddenOwnershipError('denied');
      const response = handleError(error);
      expect(response.statusCode).toBe(403);
    });

    it('defends against malformed specifications tracking low level domain payload crashes yielding strictly 400 Bad Request instances', () => {
      const error = new InvalidDeviceNameError();
      const response = handleError(error);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Controllers Basic Routing & Validation', () => {
    let repo: InMemoryDeviceRepository;
    let publisher: InMemoryDeviceEventPublisher;
    let topologyPort: TopologyReferencePort;
    let integrationsCtrl: IntegrationsController;
    let inboxCtrl: InboxController;
    let deviceCtrl: DeviceController;

    const mockDeps = {
      idGenerator: { generate: () => 'fixed-api-mock-id' },
      clock: { now: () => '2026-01-01T00:00:00Z' }
    };

    beforeEach(() => {
      repo = new InMemoryDeviceRepository();
      publisher = new InMemoryDeviceEventPublisher();
      topologyPort = {
        validateHomeExists: jest.fn().mockResolvedValue(undefined),
        validateHomeOwnership: jest.fn().mockResolvedValue(undefined),
        validateRoomBelongsToHome: jest.fn().mockResolvedValue(undefined)
      };

      integrationsCtrl = new IntegrationsController(repo, publisher, topologyPort, mockDeps.idGenerator, mockDeps.clock);
      inboxCtrl = new InboxController(repo, topologyPort);
      deviceCtrl = new DeviceController(repo, publisher, topologyPort, mockDeps.idGenerator, mockDeps.clock);
    });

    describe('IntegrationsController (POST /integrations/discovery)', () => {
      it('returns 400 when payload is completely invalid', async () => {
        const req: HttpRequest = { body: null };
        const res = await integrationsCtrl.discoverDevice(req);
        expect(res.statusCode).toBe(400);
      });

      it('returns 201 when discovery payload is complete', async () => {
        const req: HttpRequest = {
          body: { homeId: 'h', externalId: 'e', name: 'n', type: 't', vendor: 'v' }
        };
        const res = await integrationsCtrl.discoverDevice(req);
        expect(res.statusCode).toBe(201);
      });
    });

    describe('InboxController (GET /homes/:homeId/inbox)', () => {
      it('returns 400 when homeId parameter is missing or empty', async () => {
        const req: AuthenticatedHttpRequest = { params: { homeId: '  ' }, userId: 'user1' };
        const res = await inboxCtrl.getInbox(req);
        expect(res.statusCode).toBe(400);
      });

      it('returns 200 array when properly authenticated safely validating explicit parameters', async () => {
        const req: AuthenticatedHttpRequest = { params: { homeId: 'h1' }, userId: 'user1' };
        const res = await inboxCtrl.getInbox(req);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe('DeviceController (POST /devices/:deviceId/assign)', () => {
      it('returns 400 when roomId body parameter is missing', async () => {
        const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: {}, userId: 'u1' };
        const res = await deviceCtrl.assignDevice(req);
        expect(res.statusCode).toBe(400);
      });

      it('returns 200 when assigning a device correctly via mocked successful dependencies', async () => {
        // Pre-carga local simulando etapa Inbox completada
        await repo.saveDevice({
          id: 'd1', homeId: 'h1', roomId: null, externalId: 'e', name: 'n', type: 't', vendor: 'v',
          status: 'PENDING', entityVersion: 1, createdAt: 'x', updatedAt: 'x'
        });

        const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: { roomId: 'r1' }, userId: 'u1' };
        const res = await deviceCtrl.assignDevice(req);
        
        expect(res.statusCode).toBe(200);
      });
    });
  });
});
