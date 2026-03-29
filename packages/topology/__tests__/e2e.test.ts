import { HomeController, RoomController } from '../api/controllers';
import { requireAuth } from '../api/middleware/authMiddleware';
import { InMemoryHomeRepository, InMemoryRoomRepository } from '../infrastructure/repositories';
import { InMemoryEventPublisher } from '../domain/events/InMemoryEventPublisher';
import { AuthenticatedHttpRequest } from '../api/core/http';

describe('Home-Room Management Spec Verification E2E', () => {
  let homeRepo: InMemoryHomeRepository;
  let roomRepo: InMemoryRoomRepository;
  let eventPub: InMemoryEventPublisher;
  let homeController: HomeController;
  let roomController: RoomController;
  
  let guardHomeCreate: ReturnType<typeof requireAuth>;
  let guardHomeList: ReturnType<typeof requireAuth>;
  let guardRoomCreate: ReturnType<typeof requireAuth>;

  // Garantizado determinista sin random
  let mockTickId = 0;

  beforeEach(() => {
    homeRepo = new InMemoryHomeRepository();
    roomRepo = new InMemoryRoomRepository();
    eventPub = new InMemoryEventPublisher();

    const deps = {
        homeRepository: homeRepo,
        roomRepository: roomRepo,
        eventPublisher: eventPub,
        idGenerator: { generate: () => `deterministic-id-${++mockTickId}` },
        clock: { now: () => '2026-03-28T00:00:00Z' }
    };

    homeController = new HomeController(deps, deps);
    roomController = new RoomController(deps, deps);
    
    // Casting seguro garantizando que el middleware enrutará hacia el tipo AuthenticatedHttpRequest en tiempo de ejecución
    guardHomeCreate = requireAuth(async (r) => homeController.createHome(r as AuthenticatedHttpRequest));
    guardHomeList = requireAuth(async (r) => homeController.listHomes(r as AuthenticatedHttpRequest));
    guardRoomCreate = requireAuth(async (r) => roomController.createRoom(r as AuthenticatedHttpRequest));
  });

  describe('Acceptance Criteria Mapped 1:1', () => {
    it('AC1: POST /homes crea Home y devuelve 201', async () => {
      const response = await guardHomeCreate({ 
          headers: { 'x-user-id': 'user-1' }, 
          body: { name: 'Casa Principal' } 
      });
      
      expect(response.statusCode).toBe(201);
      
      const isObjectResponse = typeof response.body === 'object' && response.body !== null;
      expect(isObjectResponse).toBe(true);
      if (isObjectResponse) {
          const payload = response.body as Record<string, unknown>;
          expect(payload.name).toBe('Casa Principal');
      }

      // Verifica evento de dominio emitido implícitamente
      expect(eventPub.getEvents().length).toBe(1);
    });

    it('AC2: GET /homes devuelve el Home del dueño', async () => {
      await homeRepo.saveHome({ id: 'home-1', ownerId: 'user-2', name: 'Mi Casa', entityVersion: 1, createdAt: '', updatedAt: '' });
      
      const response = await guardHomeList({ headers: { 'x-user-id': 'user-2' } });
      
      expect(response.statusCode).toBe(200);
      
      const isArray = Array.isArray(response.body);
      expect(isArray).toBe(true);
      if (isArray) {
        expect(response.body.length).toBe(1);
        expect((response.body[0] as Record<string, unknown>).name).toBe('Mi Casa');
      }
    });

    it('AC3: GET /homes devuelve [] si el usuario no tiene Homes', async () => {
      const response = await guardHomeList({ headers: { 'x-user-id': 'tenant-test' } });
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('AC4: POST /rooms crea Room válido y devuelve 201', async () => {
      await homeRepo.saveHome({ id: 'home-alfa', ownerId: 'user-alfa', name: 'Alpha', entityVersion: 1, createdAt: '', updatedAt: '' });

      const response = await guardRoomCreate({ 
          headers: { 'x-user-id': 'user-alfa' }, 
          body: { name: 'Sala', homeId: 'home-alfa' } 
      });
      
      expect(response.statusCode).toBe(201);
    });

    it('AC5: POST /rooms sobre Home ajeno devuelve 403', async () => {
      await homeRepo.saveHome({ id: 'home-base', ownerId: 'user-alfa', name: 'Alpha', entityVersion: 1, createdAt: '', updatedAt: '' });

      const attackResponse = await guardRoomCreate({ 
          headers: { 'x-user-id': 'hacker-beta' }, 
          body: { name: 'Sala Robada', homeId: 'home-base' } 
      });
      
      expect(attackResponse.statusCode).toBe(403);
    });

    it('AC6: POST /rooms sobre Home inexistente devuelve 404', async () => {
      const response = await guardRoomCreate({ 
          headers: { 'x-user-id': 'user-A' }, 
          body: { name: 'Habitación Irreal', homeId: 'home-invalid-parent' } 
      });
      
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Validaciones Extra (Perímetro API)', () => {
    it('Peticiones de red sin contexto de autenticación retornan explícitamente 401 unauth', async () => {
      const unauthResponse = await guardHomeCreate({ 
          headers: {}, // Sin identity
          body: { name: 'Intento' } 
      });
      expect(unauthResponse.statusCode).toBe(401);
    });

    it('Peticiones de red con cuerpo malformado o campos vacíos retornan 400 bad request', async () => {
      const badPayloadResponse = await guardHomeCreate({ 
          headers: { 'x-user-id': 'user-A' }, 
          body: { name: '' } // String vacío
      });
      expect(badPayloadResponse.statusCode).toBe(400); 
    });
  });
});
