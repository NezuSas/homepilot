import { listRoomsUseCase } from '../application/listRoomsUseCase';
import { ForbiddenError, NotFoundError } from '../application/errors';
import type { HomeRepository } from '../domain/repositories/HomeRepository';
import type { RoomRepository } from '../domain/repositories/RoomRepository';

const home = { id: 'home-1', ownerId: 'owner-1', name: 'Home', entityVersion: 1, createdAt: '', updatedAt: '' };
const rooms = [{ id: 'room-1', homeId: 'home-1', name: 'Kitchen', entityVersion: 1, createdAt: '', updatedAt: '' }];

function dependencies(homes = [home]) {
  const homeRepository = { findHomesByUserId: jest.fn().mockResolvedValue(homes) } as unknown as jest.Mocked<HomeRepository>;
  const roomRepository = { findRoomsByHomeId: jest.fn().mockResolvedValue(rooms) } as unknown as jest.Mocked<RoomRepository>;
  return { homeRepository, roomRepository };
}

describe('Feature: authorized room listing', () => {
  it('returns rooms only after authorizing the requested home', async () => {
    const deps = dependencies();

    await expect(listRoomsUseCase('home-1', 'user-1', deps)).resolves.toEqual(rooms);
    expect(deps.homeRepository.findHomesByUserId).toHaveBeenCalledWith('user-1');
    expect(deps.roomRepository.findRoomsByHomeId).toHaveBeenCalledWith('home-1');
  });

  it('fails closed for a missing or mismatched home without querying rooms', async () => {
    const missing = dependencies([]);
    const forbidden = dependencies([{ ...home, id: 'another-home' }]);

    await expect(listRoomsUseCase('home-1', 'user-1', missing)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listRoomsUseCase('home-1', 'user-1', forbidden)).rejects.toBeInstanceOf(ForbiddenError);
    expect(missing.roomRepository.findRoomsByHomeId).not.toHaveBeenCalled();
    expect(forbidden.roomRepository.findRoomsByHomeId).not.toHaveBeenCalled();
  });
});