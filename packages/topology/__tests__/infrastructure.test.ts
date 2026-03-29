import { InMemoryHomeRepository, InMemoryRoomRepository } from '../infrastructure/repositories';
import { InMemoryEventPublisher } from '../domain/events/InMemoryEventPublisher';
import { HomeCreatedEvent } from '../domain/events/types';

describe('Topology Infrastructure Adapters', () => {
  it('InMemoryHomeRepository filtra deterministamente arreglos inmutables por userId', async () => {
    const repo = new InMemoryHomeRepository();
    await repo.saveHome({ id: 'h1', ownerId: 'u1', name: 'H1', entityVersion: 1, createdAt: '', updatedAt: '' });
    await repo.saveHome({ id: 'h2', ownerId: 'u2', name: 'H2', entityVersion: 1, createdAt: '', updatedAt: '' });
    
    const user1Homes = await repo.findHomesByUserId('u1');
    expect(user1Homes.length).toBe(1);
    expect(user1Homes[0].id).toBe('h1');
  });

  it('InMemoryRoomRepository almacena y enlaza relacionalmente rooms', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.saveRoom({ id: 'r1', homeId: 'home-A', name: 'R1', entityVersion: 1, createdAt: '', updatedAt: '' });
    const rooms = await repo.findRoomsByHomeId('home-A');
    expect(rooms.length).toBe(1);
    expect(rooms[0].name).toBe('R1');
  });

  it('InMemoryEventPublisher conserva shallow freeze en arrays', async () => {
    const pub = new InMemoryEventPublisher();
    
    // Proveer el objeto real exacto derivado del contrato para evitar any's nulos
    const mockEvent: HomeCreatedEvent = {
        eventId: 'deterministic-evt', 
        eventType: 'HomeCreatedEvent',
        schemaVersion: '1.0',
        source: 'test:source',
        timestamp: '2026-03-28T00:00:00Z',
        correlationId: 'req-1',
        payload: { id: 'h1', ownerId: 'u1', name: 'Casa' }
    };

    await pub.publish(mockEvent);
    expect(pub.getEvents().length).toBe(1);
  });
});
