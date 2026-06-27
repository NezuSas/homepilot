import { 
  createHomeUseCase, 
  createRoomUseCase, 
  renameRoomUseCase,
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

  it('renameRoomUseCase preserves room identity and publishes the rename after persistence', async () => {
    const homeRepo = new InMemoryHomeRepository();
    const roomRepo = new InMemoryRoomRepository();
    const eventPub = new InMemoryEventPublisher();
    await homeRepo.saveHome({ id: 'h1', ownerId: 'user-A', name: 'Casa', entityVersion: 1, createdAt: '', updatedAt: '' });
    await roomRepo.saveRoom({ id: 'r1', homeId: 'h1', name: 'Jardin', entityVersion: 1, createdAt: 'created', updatedAt: 'old' });

    const renamed = await renameRoomUseCase('r1', 'Jardín principal', 'user-A', 'corr-rename', {
      homeRepository: homeRepo,
      roomRepository: roomRepo,
      eventPublisher: eventPub,
      ...mockDeps,
    });

    expect(renamed).toEqual(expect.objectContaining({
      id: 'r1',
      homeId: 'h1',
      name: 'Jardín principal',
      entityVersion: 2,
      createdAt: 'created',
    }));
    expect((await roomRepo.findRoomById('r1'))?.name).toBe('Jardín principal');
    expect(eventPub.getEvents()[0]).toEqual(expect.objectContaining({
      eventType: 'RoomRenamedEvent',
      payload: expect.objectContaining({ previousName: 'Jardin', name: 'Jardín principal' }),
    }));
  });

  it('renameRoomUseCase rejects changes from a different home owner', async () => {
    const homeRepo = new InMemoryHomeRepository();
    const roomRepo = new InMemoryRoomRepository();
    await homeRepo.saveHome({ id: 'h1', ownerId: 'user-A', name: 'Casa', entityVersion: 1, createdAt: '', updatedAt: '' });
    await roomRepo.saveRoom({ id: 'r1', homeId: 'h1', name: 'Sala', entityVersion: 1, createdAt: '', updatedAt: '' });

    await expect(renameRoomUseCase('r1', 'Otra sala', 'user-B', 'corr-rename', {
      homeRepository: homeRepo,
      roomRepository: roomRepo,
      eventPublisher: new InMemoryEventPublisher(),
      ...mockDeps,
    })).rejects.toThrow(ForbiddenError);
  });
});
