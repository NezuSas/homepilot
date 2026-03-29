import { 
  Home, 
  createHome, 
  HomeRepository,
  TopologyEventPublisher,
  createHomeCreatedEvent,
  IdGenerator,
  Clock
} from '../domain';

/**
 * Estructura de dependencias operacionales de aplicación para aislar la orquestación.
 */
export interface CreateHomeUseCaseDependencies {
  readonly homeRepository: HomeRepository;
  readonly eventPublisher: TopologyEventPublisher;
  readonly idGenerator: IdGenerator;
  readonly clock: Clock;
}

/**
 * Orquesta la creación transaccional de un Home aplicando el patrón NFR-04 y mitigaciones NFR-05.
 * 
 * @param name Nombre del hogar a crear (vía Payload).
 * @param userId Propietario del hogar (vía Auth Context).
 * @param correlationId Trazabilidad de origen (vía Auth Context/Header).
 * @param dependencies Puertos de salida y utilidades inyectadas para lógica desacoplada.
 * @returns Entidad Home inmutable persistida y lista para Serialización.
 */
export async function createHomeUseCase(
  name: string,
  userId: string,
  correlationId: string,
  dependencies: CreateHomeUseCaseDependencies
): Promise<Home> {
  const { homeRepository, eventPublisher, idGenerator, clock } = dependencies;
  const coreDeps = { idGenerator, clock };

  // 1. Instanciación temporal en memoria (Lógica Pura de Dominio)
  const home = createHome(name, userId, coreDeps);

  // 2. Persistencia atómica
  // Si esto falla (lanza error I/O subyacente), la ejecución aborta y NO corre la publicación.
  await homeRepository.saveHome(home);

  // 3. Transformación al Evento Cerrado de Dominio
  const event = createHomeCreatedEvent(
    correlationId,
    { id: home.id, ownerId: home.ownerId, name: home.name },
    coreDeps
  );

  // 4. Publicación Asíncrona Tolerante a Fallos (NFR-05)
  // Si Publish falla, capturamos el error silenciosamente permitiendo
  // que la operación perimetral resuelva a un estado exitoso asumiendo persistencia completada.
  try {
    await eventPublisher.publish(event);
  } catch (error) {
    // Tolerado por NFR-05 (Spec v1). 
    // Outbox automático relegado al roadmap de iteración v2.
  }

  return home;
}
