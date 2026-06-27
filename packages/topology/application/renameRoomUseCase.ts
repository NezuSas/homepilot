import {
  Clock,
  createRoomRenamedEvent,
  HomeRepository,
  IdGenerator,
  renameRoom,
  Room,
  RoomRepository,
  TopologyEventPublisher,
} from '../domain';
import { NotFoundError } from './errors';
import { validateHomeOwnership } from './validateHomeOwnership';

export interface RenameRoomUseCaseDependencies {
  readonly homeRepository: HomeRepository;
  readonly roomRepository: RoomRepository;
  readonly eventPublisher: TopologyEventPublisher;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

export async function renameRoomUseCase(
  roomId: string,
  name: string,
  userId: string,
  correlationId: string,
  dependencies: RenameRoomUseCaseDependencies
): Promise<Room> {
  const currentRoom = await dependencies.roomRepository.findRoomById(roomId);
  if (!currentRoom) throw new NotFoundError('Room', roomId);

  await validateHomeOwnership(currentRoom.homeId, userId, dependencies.homeRepository);

  const updatedRoom = renameRoom(currentRoom, name, dependencies.clock);
  await dependencies.roomRepository.saveRoom(updatedRoom);

  try {
    await dependencies.eventPublisher.publish(createRoomRenamedEvent(
      correlationId,
      {
        id: updatedRoom.id,
        homeId: updatedRoom.homeId,
        previousName: currentRoom.name,
        name: updatedRoom.name,
        entityVersion: updatedRoom.entityVersion,
      },
      dependencies,
    ));
  } catch {
    // Write-Then-Publish: local persistence remains authoritative while offline.
  }

  return updatedRoom;
}
