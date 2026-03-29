import { 
  createHomeUseCase, 
  createRoomUseCase, 
  listHomesUseCase, 
  ForbiddenError, 
  NotFoundError, 
  InvalidContextError 
} from '../application';
import { InMemoryHomeRepository, InMemoryRoomRepository } from '../infrastructure/repositories';
import { InMemoryEventPublisher } from '../domain/events/InMemoryEventPublisher';

describe('Topology Application Layer', () => {
  const mockDeps = {
    idGenerator: { generate: () => 'evt-id' },
    clock: { now: () => '2020-01-01T00:00:00Z' }
  };

  it('listHomesUseCase intercepta explícitamente contexts sin owner (InvalidContextError)', async () => {
    const deps = { homeRepository: new InMemoryHomeRepository() };
    await expect(listHomesUseCase('', deps)).rejects.toThrow(InvalidContextError);
  });

  it('createHomeUseCase aplica Write-Then-Publish atómico', async () => {
    const homeRepo = new InMemoryHomeRepository();
    const eventPub = new InMemoryEventPublisher();
    
    const home = await createHomeUseCase('Casa', 'user-A', 'corr-1', {
      homeRepository: homeRepo,
      eventPublisher: eventPub,
      ...mockDeps
    });
    
    // Verificación Repo
    const saved = await homeRepo.findHomesByUserId('user-A');
    expect(saved[0].id).toBe(home.id);

    // Verificación Event Bus Pattern
    const events = eventPub.getEvents();
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe('HomeCreatedEvent');
  });

  it('createRoomUseCase NFR-09 prohíbe creación si el Home pertenece a otro Tenant (Zero-Trust)', async () => {
    const homeRepo = new InMemoryHomeRepository();
    await homeRepo.saveHome({ id: 'h1', ownerId: 'user-ALPHA', name: 'Casa Alpha', entityVersion: 1, createdAt: '', updatedAt: '' });
    
    const useCasePromise = createRoomUseCase('Sala', 'h1', 'user-BETA', 'corr-1', {
      homeRepository: homeRepo,
      roomRepository: new InMemoryRoomRepository(),
      eventPublisher: new InMemoryEventPublisher(),
      ...mockDeps
    });

    await expect(useCasePromise).rejects.toThrow(ForbiddenError);
  });

  it('createRoomUseCase eleva NotFoundError si el padre topológico es inexistente referencialmente', async () => {
    const useCasePromise = createRoomUseCase('Sala', 'ghost-home-1', 'u1', 'corr-1', {
      homeRepository: new InMemoryHomeRepository(),
      roomRepository: new InMemoryRoomRepository(),
      eventPublisher: new InMemoryEventPublisher(),
      ...mockDeps
    });

    await expect(useCasePromise).rejects.toThrow(NotFoundError);
  });
});
