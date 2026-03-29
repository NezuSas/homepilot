import { ActivityLogRepository, ActivityRecord } from '../domain/repositories/ActivityLogRepository';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from './ports/TopologyReferencePort';
import { DeviceNotFoundError } from './errors';

export interface GetDeviceActivityHistoryDependencies {
  deviceRepository: DeviceRepository;
  topologyPort: TopologyReferencePort;
  activityLogRepository: ActivityLogRepository;
}

/**
 * Consulta el historial de actividad derivada (Read Model) para fines de observabilidad.
 * Devuelve trazas de comandos y cambios de estado ordenados cronológicamente.
 */
export async function getDeviceActivityHistoryUseCase(
  deviceId: string,
  userId: string,
  limit: number,
  deps: GetDeviceActivityHistoryDependencies
): Promise<ReadonlyArray<ActivityRecord>> {
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  
  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // Blindaje Zero-Trust: El historial revela comportamiento privado del hogar
  await deps.topologyPort.validateHomeOwnership(device.homeId, userId);

  return deps.activityLogRepository.findRecentByDeviceId(deviceId, limit);
}
