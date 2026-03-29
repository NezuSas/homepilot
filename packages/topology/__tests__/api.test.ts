import { requireAuth } from '../api/middleware/authMiddleware';
import { handleError } from '../api/core/errorHandler';
import { ForbiddenError, NotFoundError } from '../application';
import { TopologyDomainError } from '../domain';
import { HttpRequest, AuthenticatedHttpRequest } from '../api/core/http';
import { HomeController, RoomController } from '../api/controllers';

describe('Topology API Boundary', () => {
  describe('authMiddleware Guard', () => {
    it('requireAuth bloquea flujos sin x-user-id explícito (401)', async () => {
      // Mock tipeado explícitamente sin "as any"
      const nextMock = async (req: AuthenticatedHttpRequest) => ({ statusCode: 200, body: 'OK' });
      const interceptor = requireAuth(nextMock);
      
      const response = await interceptor({ headers: {} });
      expect(response.statusCode).toBe(401);
      
      const isRecord = typeof response.body === 'object' && response.body !== null;
      if (isRecord) {
        expect((response.body as Record<string, unknown>).error).toBeDefined();
      }
    });

    it('requireAuth nutre correctamente las capas inferiores con Context seguro', async () => {
      let injectedId = '';
      const nextMock = async (req: AuthenticatedHttpRequest) => {
        injectedId = req.userId;
        return { statusCode: 200, body: 'OK' };
      };

      const interceptor = requireAuth(nextMock);
      await interceptor({ headers: { 'x-user-id': 'legit-user' } });
      expect(injectedId).toBe('legit-user');
    });
  });

  describe('Exception Mapper', () => {
    it('traduce ForbiddenError estrictamente a REST 403', () => {
      const resp = handleError(new ForbiddenError());
      expect(resp.statusCode).toBe(403);
    });

    it('traduce exclusiones del negocio estrictamente a HTTP 400', () => {
      const resp = handleError(new TopologyDomainError('Invalid Naming'));
      expect(resp.statusCode).toBe(400);
    });

    it('traduce NotFoundError relacional a HTTP 404', () => {
      const resp = handleError(new NotFoundError('Home', '123'));
      expect(resp.statusCode).toBe(404);
    });
  });

  describe('HomeController Unit Tests', () => {
    // Mockeos deterministas directos
    const mockCreateDeps = {
      homeRepository: { saveHome: async () => {}, findHomesByUserId: async () => [], findHomeById: async () => null },
      eventPublisher: { publish: async () => {} },
      idGenerator: { generate: () => 'fixed-id' },
      clock: { now: () => 'fixed-time' }
    };
    const mockListDeps = {
      homeRepository: mockCreateDeps.homeRepository
    };

    const controller = new HomeController(mockCreateDeps, mockListDeps);

    it('createHome devuelve 400 estático si falta parametro name antes de usar los UseCases', async () => {
      const req: AuthenticatedHttpRequest = { userId: 'u1', body: {} };
      const resp = await controller.createHome(req);
      expect(resp.statusCode).toBe(400);
    });

    it('listHomes devuelve 200 de forma base', async () => {
      const req: AuthenticatedHttpRequest = { userId: 'user-01' };
      const resp = await controller.listHomes(req);
      expect(resp.statusCode).toBe(200);
    });
  });

  describe('RoomController Unit Tests', () => {
    const testRoomDeps = {
      homeRepository: { saveHome: async() => {}, findHomesByUserId: async() => [], findHomeById: async () => ({ id: 'h1', ownerId: 'u1', name: 'H', entityVersion: 1, createdAt: '', updatedAt: '' }) },
      roomRepository: { saveRoom: async() => {}, findRoomsByHomeId: async() => [] },
      eventPublisher: { publish: async () => {} },
      idGenerator: { generate: () => 'fixed-id' },
      clock: { now: () => 'fixed-time' }
    };

    const controller = new RoomController(testRoomDeps, testRoomDeps);

    it('createRoom intercepta de raíz fallos HTTP 400 si falta el scope padre (homeId)', async () => {
      const req: AuthenticatedHttpRequest = { userId: 'u1', body: { name: 'Sala' } };
      const resp = await controller.createRoom(req);
      expect(resp.statusCode).toBe(400);
    });

    it('listRooms falla explícitamente RESTFUL vía 400 si se omite el parent identifier de ruta', async () => {
      const req: AuthenticatedHttpRequest = { userId: 'u1', query: {} };
      const resp = await controller.listRooms(req);
      expect(resp.statusCode).toBe(400);
    });
  });
});
