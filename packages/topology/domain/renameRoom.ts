import { InvalidRoomNameError } from './errors';
import { Clock, Room } from './types';

export function renameRoom(room: Room, name: string, clock: Clock): Room {
  const normalizedName = name.trim();
  if (!normalizedName) throw new InvalidRoomNameError();

  return Object.freeze({
    ...room,
    name: normalizedName,
    entityVersion: room.entityVersion + 1,
    updatedAt: clock.now(),
  });
}
