import { handleError, IntegrationsController, InboxController, DeviceController } from '../api';
import { DeviceConflictError, TopologyResourceNotFoundError, ForbiddenOwnershipError } from '../application/errors';
import { InvalidDeviceNameError } from '../domain/errors';
import { InMemoryDeviceRepository } from '../infrastructure/repositories';
import { InMemoryDeviceEventPublisher } from '../domain/events';
import { TopologyReferencePort } from '../application/ports/TopologyReferencePort';
import { HttpRequest, AuthenticatedHttpRequest } from '../../topology/api/core/http';

describe('Módulo Devices - Capa API REST', () => {

  describe('Mapper Estándar HTTP (errorHandler)', () => {
    it('debe mapear el error transaccional nativo DeviceConflictError orientando las respuestas HTTP a 409 protegiendo reglas de negocio', () => {
      const error = new DeviceConflictError('ext1', 'h1');
      const response = handleError(error);
      expect(response.statusCode).toBe(409);
      expect(response.body).toEqual({ error: 'Conflict', message: error.message });
    });

    it('debe traducir TopologyResourceNotFoundError igualando de forma estricta las definiciones RESTful y devolviendo de forma orillada HTTP 404', () => {
      const error = new TopologyResourceNotFoundError('Home', 'h1');
      const response = handleError(error);
      expect(response.statusCode).toBe(404);
    });

    it('debe extraer correctamente las propiedades de violaciones de seguridad devolviendo bloqueos explícitos HTTP 403', () => {
      const error = new ForbiddenOwnershipError('denied');
      const response = handleError(error);
      expect(response.statusCode).toBe(403);
    });

    it('debe defender al dominio base interceptando caídas y arrojando instancias restrictas HTTP 400 Bad Request', () => {
      const error = new InvalidDeviceNameError();
      const response = handleError(error);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Enrutamiento y Validación Básica de Controllers', () => {
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
      it('debe retornar 400 cuando el payload sea estructuralmente inválido', async () => {
        const req: HttpRequest = { body: null };
        const res = await integrationsCtrl.discoverDevice(req);
        expect(res.statusCode).toBe(400);
      });

      it('debe retornar 201 cuando se envíe un payload de discovery íntegro', async () => {
        const req: HttpRequest = {
          body: { homeId: 'h', externalId: 'e', name: 'n', type: 't', vendor: 'v' }
        };
        const res = await integrationsCtrl.discoverDevice(req);
        expect(res.statusCode).toBe(201);
      });
    });

    describe('InboxController (GET /homes/:homeId/inbox)', () => {
      it('debe retornar 400 cuando el parámetro homeId se encuentre omitido o vacío', async () => {
        const req: AuthenticatedHttpRequest = { params: { homeId: '  ' }, userId: 'user1' };
        const res = await inboxCtrl.getInbox(req);
        expect(res.statusCode).toBe(400);
      });

      it('debe retornar 200 con un arreglo al autenticarse correctamente y tras validaciones de parámetros limpias y explícitas', async () => {
        const req: AuthenticatedHttpRequest = { params: { homeId: 'h1' }, userId: 'user1' };
        const res = await inboxCtrl.getInbox(req);
        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
      });
    });

    describe('DeviceController (POST /devices/:deviceId/assign)', () => {
      it('debe retornar 400 si se omite el fragmento roomId en los parámetros del payload', async () => {
        const req: AuthenticatedHttpRequest = { params: { deviceId: 'd1' }, body: {}, userId: 'u1' };
        const res = await deviceCtrl.assignDevice(req);
        expect(res.statusCode).toBe(400);
      });

      it('debe retornar 200 al asignarse positivamente un Device valiéndose de dependencias simuladas aprobadas', async () => {
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
