import { ForbiddenOwnershipError, TopologyResourceNotFoundError } from '../../../application/errors';
import { RepositoryTopologyReferenceAdapter } from '../RepositoryTopologyReferenceAdapter';
import type { HomeRepository } from '../../../../topology/domain/repositories/HomeRepository';
import type { RoomRepository } from '../../../../topology/domain/repositories/RoomRepository';

function repositories(homeExists = true, roomHomeId: string | null = 'home-1'): {
  homeRepository: HomeRepository;
  roomRepository: RoomRepository;
} {
  return {
    homeRepository: {
      saveHome: jest.fn(),
      findHomesByUserId: jest.fn().mockResolvedValue(homeExists ? [{ id: 'home-1', ownerId: 'owner-1' }] : []),
      findHomeById: jest.fn().mockResolvedValue(homeExists ? { id: 'home-1', ownerId: 'owner-1' } : null),
      findAll: jest.fn(),
    },
    roomRepository: {
      saveRoom: jest.fn(),
      findRoomsByHomeId: jest.fn(),
      findRoomById: jest.fn().mockResolvedValue(roomHomeId ? { id: 'room-1', homeId: roomHomeId } : null),
      findAll: jest.fn(),
      deleteRoomAndUnassignDevices: jest.fn(),
    },
  };
}

describe('Feature: Repository topology reference adapter', () => {
  it('Scenario: Given an existing home When its existence is validated Then the adapter completes', async () => {
    const { homeRepository, roomRepository } = repositories();
    const adapter = new RepositoryTopologyReferenceAdapter(homeRepository, roomRepository);

    await expect(adapter.validateHomeExists('home-1')).resolves.toBeUndefined();
  });

  it('Scenario: Given an absent home When ownership is validated Then the adapter reports not found', async () => {
    const { homeRepository, roomRepository } = repositories(false);
    const adapter = new RepositoryTopologyReferenceAdapter(homeRepository, roomRepository);

    await expect(adapter.validateHomeOwnership('missing-home', 'owner-1')).rejects.toBeInstanceOf(TopologyResourceNotFoundError);
  });

  it('Scenario: Given a foreign home or room When a topology reference is validated Then the adapter rejects access', async () => {
    const foreignHome = repositories();
    const ownershipAdapter = new RepositoryTopologyReferenceAdapter(foreignHome.homeRepository, foreignHome.roomRepository);
    await expect(ownershipAdapter.validateHomeOwnership('home-1', 'other-user')).resolves.toBeUndefined();

    const foreignRoom = repositories(true, 'other-home');
    const roomAdapter = new RepositoryTopologyReferenceAdapter(foreignRoom.homeRepository, foreignRoom.roomRepository);
    await expect(roomAdapter.validateRoomBelongsToHome('room-1', 'home-1')).rejects.toBeInstanceOf(ForbiddenOwnershipError);
  });
});