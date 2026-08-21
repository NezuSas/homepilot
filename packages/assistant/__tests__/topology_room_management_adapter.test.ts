import { TopologyRoomManagementAdapter } from '../infrastructure/TopologyRoomManagementAdapter';
import { InMemoryHomeRepository, InMemoryRoomRepository } from '../../topology/infrastructure/repositories';
import { InMemoryEventPublisher } from '../../topology/domain/events';

describe('TopologyRoomManagementAdapter', () => {
  it('creates a room in the caller\'s authorized installed home through the Topology use case', async () => {
    const homeRepository = new InMemoryHomeRepository();
    const roomRepository = new InMemoryRoomRepository();
    const eventPublisher = new InMemoryEventPublisher();
    await homeRepository.saveHome({
      id: 'home-1',
      ownerId: 'owner-1',
      name: 'Home',
      entityVersion: 1,
      createdAt: '',
      updatedAt: ''
    });
    const adapter = new TopologyRoomManagementAdapter({
      homeRepository,
      roomRepository,
      eventPublisher,
      idGenerator: { generate: () => 'room-1' },
      clock: { now: () => '2026-08-20T23:00:00.000Z' }
    });

    const room = await adapter.createRoom({
      userId: 'owner-1',
      name: 'Biblioteca',
      correlationId: 'assistant:room-create:test'
    });

    expect(room).toEqual(expect.objectContaining({ id: 'room-1', homeId: 'home-1', name: 'Biblioteca' }));
    await expect(roomRepository.findRoomById('room-1')).resolves.toEqual(expect.objectContaining({ homeId: 'home-1', name: 'Biblioteca' }));
    expect(eventPublisher.getEvents()).toEqual([expect.objectContaining({ eventType: 'RoomCreatedEvent' })]);
  });

  it('fails closed when the caller has no authorized home', async () => {
    const adapter = new TopologyRoomManagementAdapter({
      homeRepository: new InMemoryHomeRepository(),
      roomRepository: new InMemoryRoomRepository(),
      eventPublisher: new InMemoryEventPublisher(),
      idGenerator: { generate: () => 'room-1' },
      clock: { now: () => '2026-08-20T23:00:00.000Z' }
    });

    await expect(adapter.createRoom({
      userId: 'unrelated-user',
      name: 'Biblioteca',
      correlationId: 'assistant:room-create:test'
    })).rejects.toThrow('ASSISTANT_HOME_NOT_FOUND');
  });
});