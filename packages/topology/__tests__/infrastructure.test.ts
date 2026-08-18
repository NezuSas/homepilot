import { InMemoryHomeRepository, InMemoryRoomRepository } from '../infrastructure/repositories';
import { SingleHomeInstallationError } from '../domain/errors';
import { InMemoryEventPublisher } from '../domain/events/InMemoryEventPublisher';
import { HomeCreatedEvent } from '../domain/events/types';

describe('Topology Infrastructure Adapters', () => {
  it('InMemoryHomeRepository filtra deterministamente arreglos inmutables por userId', async () => {
    const repo = new InMemoryHomeRepository();
    await repo.saveHome({ id: 'h1', ownerId: 'u1', name: 'H1', entityVersion: 1, createdAt: '', updatedAt: '' });
    await repo.saveHome({ id: 'h2', ownerId: 'u2', name: 'H2', entityVersion: 1, createdAt: '', updatedAt: '' });
    
    await expect(repo.findHomesByUserId('u1')).rejects.toBeInstanceOf(SingleHomeInstallationError);
  });

  it('InMemoryRoomRepository almacena y enlaza relacionalmente rooms', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.saveRoom({ id: 'r1', homeId: 'home-A', name: 'R1', entityVersion: 1, createdAt: '', updatedAt: '' });
    const rooms = await repo.findRoomsByHomeId('home-A');
    expect(rooms.length).toBe(1);
    expect(rooms[0].name).toBe('R1');
  });

  it('InMemoryRoomRepository devuelve copias aisladas, filtra por hogar y elimina la estancia indicada', async () => {
    const repo = new InMemoryRoomRepository();
    const roomA = { id: 'r1', homeId: 'home-A', name: 'Sala', entityVersion: 1, createdAt: '', updatedAt: '' };
    const roomB = { id: 'r2', homeId: 'home-B', name: 'Oficina', entityVersion: 1, createdAt: '', updatedAt: '' };

    await repo.saveRoom(roomA);
    await repo.saveRoom(roomB);

    const room = await repo.findRoomById(roomA.id);
    const roomsForHomeA = await repo.findRoomsByHomeId(roomA.homeId);

    expect(room).toEqual(roomA);
    expect(room).not.toBe(roomA);
    expect(Object.isFrozen(room)).toBe(true);
    expect(roomsForHomeA).toEqual([roomA]);
    expect(Object.isFrozen(roomsForHomeA)).toBe(true);
    await expect(repo.findRoomById('missing')).resolves.toBeNull();
    await expect(repo.findAll()).resolves.toEqual(expect.arrayContaining([roomA, roomB]));
    await expect(repo.deleteRoomAndUnassignDevices(roomA.id, '2026-08-17T00:00:00.000Z')).resolves.toBe(0);
    await expect(repo.findRoomsByHomeId(roomA.homeId)).resolves.toEqual([]);
    repo.clear();
    await expect(repo.findAll()).resolves.toEqual([]);
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
    expect(Object.isFrozen(pub.getEvents()[0])).toBe(true);
    pub.clear();
    expect(pub.getEvents()).toEqual([]);
  });
  it('InMemoryHomeRepository returns frozen saved homes, missing values, and clears storage', async () => {
    const repo = new InMemoryHomeRepository();
    const home = { id: 'h1', ownerId: 'u1', name: 'H1', entityVersion: 1, createdAt: '', updatedAt: '' };

    await repo.saveHome(home);
    const saved = await repo.findHomeById('h1');
    const all = await repo.findAll();

    expect(saved).toEqual(home);
    expect(Object.isFrozen(saved)).toBe(true);
    expect(all).toEqual([home]);
    expect(Object.isFrozen(all)).toBe(true);
    await expect(repo.findHomesByUserId('unrelated-user')).resolves.toEqual([home]);
    await expect(repo.findHomeById('missing')).resolves.toBeNull();

    repo.clear();
    await expect(repo.findAll()).resolves.toEqual([]);
  });
});
