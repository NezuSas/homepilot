import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { TopologyReferencePort } from './ports/TopologyReferencePort';
import { DeviceNotFoundError } from './errors';

export interface GetDeviceStateDependencies {
  deviceRepository: DeviceRepository;
  topologyPort: TopologyReferencePort;
}

/**
 * Recupera el último estado conocido (`lastKnownState`) de un dispositivo.
 * Aplica validaciones de seguridad perimetral (Zero-Trust) consultando al Contexto de Topología.
 */
export async function getDeviceStateUseCase(
  deviceId: string,
  userId: string,
  deps: GetDeviceStateDependencies
): Promise<Record<string, unknown> | null> {
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  
  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // Validación de Propiedad: Solo el dueño del Home puede observar el estado
  await deps.topologyPort.validateHomeOwnership(device.homeId, userId);

  return device.lastKnownState;
}
