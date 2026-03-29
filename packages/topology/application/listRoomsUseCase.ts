import { Room, RoomRepository, HomeRepository } from '../domain';
import { validateHomeOwnership } from './validateHomeOwnership';

export interface ListRoomsUseCaseDependencies {
  readonly homeRepository: HomeRepository;
  readonly roomRepository: RoomRepository;
}

/**
 * Orquesta la recuperación de datos validando primeramente jerarquía padre contra sesión actual.
 * Evita ataques API REST que interroguen IDs aleatorios a pesar de estar lógicamente autorizados en el global context.
 */
export async function listRoomsUseCase(
  homeId: string,
  userId: string,
  dependencies: ListRoomsUseCaseDependencies
): Promise<ReadonlyArray<Room>> {
  // 1. Barrera Restrictiva: Requerir ownership del nodo padre explícitamente.
  // Lanza Excepciones si el Home no existe o un tercero cruza peticiones REST manipulando IDs.
  await validateHomeOwnership(homeId, userId, dependencies.homeRepository);

  // 2. Realizar listado seguro
  return dependencies.roomRepository.findRoomsByHomeId(homeId);
}
