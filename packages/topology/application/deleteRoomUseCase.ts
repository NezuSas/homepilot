import { HomeRepository, Room, RoomRepository } from '../domain';
import { NotFoundError } from './errors';
import { validateHomeOwnership } from './validateHomeOwnership';

export interface DeleteRoomUseCaseDependencies {
  readonly homeRepository: HomeRepository;
  readonly roomRepository: RoomRepository;
  readonly clock: { now(): string };
}

export interface DeletedRoom {
  readonly room: Room;
  readonly unassignedDevices: number;
}

/**
 * Elimina una habitación únicamente para el propietario de su hogar y conserva
 * en persistencia la desasignación atómica de los dispositivos vinculados.
 */
export async function deleteRoomUseCase(
  roomId: string,
  userId: string,
  dependencies: DeleteRoomUseCaseDependencies,
): Promise<DeletedRoom> {
  const room = await dependencies.roomRepository.findRoomById(roomId);
  if (!room) throw new NotFoundError('Room', roomId);

  await validateHomeOwnership(room.homeId, userId, dependencies.homeRepository);
  const unassignedDevices = await dependencies.roomRepository.deleteRoomAndUnassignDevices(
    roomId,
    dependencies.clock.now(),
  );

  return { room, unassignedDevices };
}