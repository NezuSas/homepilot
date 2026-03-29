import { Device } from '../domain';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from './ports/TopologyReferencePort';

export interface ListPendingInboxUseCaseDependencies {
  deviceRepository: DeviceRepository;
  topologyPort: TopologyReferencePort;
}

/**
 * Agregador aislado sirviendo rutinas de consulta visual al Inbox con filtro Auth cruzado.
 */
export async function listPendingInboxUseCase(
  homeId: string,
  userId: string,
  deps: ListPendingInboxUseCaseDependencies
): Promise<ReadonlyArray<Device>> {
  // Validación de identidad perimetral cruzada bloqueando queries ciegos
  await deps.topologyPort.validateHomeOwnership(homeId, userId);

  // Invocación a la base en búsqueda exclusiva del Stage (Inbox / PENDING).
  return deps.deviceRepository.findInboxByHomeId(homeId);
}
