import { Device, createDiscoveredDevice } from '../domain';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceEventPublisher, createDeviceDiscoveredEvent } from '../domain/events';
import { IdGenerator, Clock } from '../../shared/domain/types';
import { DeviceConflictError } from './errors';
import { TopologyReferencePort } from './ports/TopologyReferencePort';

export interface DiscoverDeviceUseCaseDependencies {
  deviceRepository: DeviceRepository;
  eventPublisher: DeviceEventPublisher;
  topologyPort: TopologyReferencePort;
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Caso de Uso orquestador responsable por la injesta Idempotente perimetral 1:1.
 */
export async function discoverDeviceUseCase(
  homeId: string,
  externalId: string,
  name: string,
  type: string,
  vendor: string,
  correlationId: string,
  deps: DiscoverDeviceUseCaseDependencies
): Promise<Device> {
  // Validación M2M estricta garantizando comportamiento 404 estructural
  await deps.topologyPort.validateHomeExists(homeId);

  const existingDevice = await deps.deviceRepository.findByExternalIdAndHomeId(externalId, homeId);
  
  if (existingDevice) {
    throw new DeviceConflictError(externalId, homeId);
  }

  const newDevice = createDiscoveredDevice(
    { homeId, externalId, name, type, vendor },
    { idGenerator: deps.idGenerator, clock: deps.clock }
  );

  await deps.deviceRepository.saveDevice(newDevice);

  const discoveredEvent = createDeviceDiscoveredEvent(
    {
      deviceId: newDevice.id,
      homeId: newDevice.homeId,
      externalId: newDevice.externalId,
      type: newDevice.type,
      vendor: newDevice.vendor,
      name: newDevice.name
    },
    correlationId,
    { idGenerator: deps.idGenerator, clock: deps.clock }
  );

  try {
    await deps.eventPublisher.publish(discoveredEvent);
  } catch {
    // Tolerancia a fallos: Patrón NFR Write-Then-Publish absorbido estáticamente preservando atomicidad de DB.
    // Interrupción silenciosa controlada aislando rutinas de logging transversales.
  }

  return newDevice;
}
