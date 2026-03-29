import { Room, IdGenerator, Clock } from './types';
import { InvalidRoomNameError, InvalidHomeIdError } from './errors';

/**
 * Dependencias requeridas para fabricar un Room, inyectadas externamente.
 */
export interface CreateRoomDependencies {
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Función de fábrica pura para inicializar entidades Room inmutables.
 * 
 * @param name Nombre designado para la habitación.
 * @param homeId Identificador del Home padre.
 * @param dependencies Generadores de puridad temporal e ID.
 * @returns Un objeto Room nuevo, inmutable y totalmente inicializado.
 */
export function createRoom(
  name: string,
  homeId: string,
  dependencies: CreateRoomDependencies
): Room {
  if (!name || name.trim() === '') {
    throw new InvalidRoomNameError();
  }

  if (!homeId || homeId.trim() === '') {
    throw new InvalidHomeIdError();
  }

  const timestamp = dependencies.clock.now();

  return Object.freeze({
    id: dependencies.idGenerator.generate(),
    homeId: homeId.trim(),
    name: name.trim(),
    entityVersion: 1, // Versión inicial
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}
