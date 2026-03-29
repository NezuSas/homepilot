import { 
  Room, 
  createRoom, 
  RoomRepository,
  HomeRepository,
  TopologyEventPublisher,
  createRoomCreatedEvent,
  IdGenerator,
  Clock
} from '../domain';
import { validateHomeOwnership } from './validateHomeOwnership';

export interface CreateRoomUseCaseDependencies {
  readonly homeRepository: HomeRepository;
  readonly roomRepository: RoomRepository;
  readonly eventPublisher: TopologyEventPublisher;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Orquesta la creación transaccional de un Room protegiendo las referencias inter-nivel del Home Padre y gestionando fallas integrales del Message Bus (NFR-05).
 * 
 * @param name Nombre designado a la habitación.
 * @param homeId Identificador del hogar adjunto.
 * @param userId Emisor activo (Zero-Trust Owner).
 * @param correlationId Trazabilidad de requests.
 * @param dependencies Puertos e Interfaces externos provistos vía inyección DI.
 * @returns Instancia Room inmutable persistida generada libre de bloqueos.
 */
export async function createRoomUseCase(
  name: string,
  homeId: string,
  userId: string,
  correlationId: string,
  dependencies: CreateRoomUseCaseDependencies
): Promise<Room> {
  const { homeRepository, roomRepository, eventPublisher, idGenerator, clock } = dependencies;
  const coreDeps = { idGenerator, clock };

  // 1. Autorización Pre-Vuelo cruzada a la Entidad Superior
  await validateHomeOwnership(homeId, userId, homeRepository);

  // 2. Transacción Lógica de fábrica pura
  const room = createRoom(name, homeId, coreDeps);

  // 3. I/O Commit al Adaptador persistente
  await roomRepository.saveRoom(room);

  // 4. Agrupamiento DTO hacia Contrato Asíncrono
  const event = createRoomCreatedEvent(
    correlationId,
    { id: room.id, homeId: room.homeId, name: room.name },
    coreDeps
  );

  // 5. Gateaway a Eventbus finalizando patrón Write-Then-Publish NFR-05 Tolerance
  try {
    await eventPublisher.publish(event);
  } catch (error) {
    // Si Publish falla, absorbemos la pérdida asíncrona devolviendo éxito
    // sobre local Storage, tolerando desconexión Cloud según Spec v1.
  }

  return room;
}
