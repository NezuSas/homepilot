import { Device } from '../domain/types';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceEventPublisher } from '../domain/events/DeviceEventPublisher';
import { ActivityLogRepository } from '../domain/repositories/ActivityLogRepository';
import { isStateIdentical } from '../domain/state';
import { createDeviceStateUpdatedEvent } from '../domain/events/factories';
import { DeviceNotFoundError } from './errors';
import { IdGenerator, Clock } from '../../shared/domain/types';

export interface SyncDeviceStateDependencies {
  deviceRepository: DeviceRepository;
  eventPublisher: DeviceEventPublisher;
  activityLogRepository: ActivityLogRepository;
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Orquesta la sincronización de estado proactiva desde el Edge/Integraciones.
 * Implementa una política de idempotencia estructural para optimizar la persistencia
 * y evitar ruido en el historial de observabilidad.
 */
export async function syncDeviceStateUseCase(
  deviceId: string,
  newState: Record<string, unknown>,
  correlationId: string,
  deps: SyncDeviceStateDependencies
): Promise<void> {
  // 1. Localización del Recurso
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // 2. Evaluación de Idempotencia (V1: Flat Object Equality)
  // Si el estado reportado es idéntico al actual, abortamos sin efectos secundarios
  if (isStateIdentical(device.lastKnownState, newState)) {
    return;
  }

  const now = deps.clock.now();

  // 3. Mutación Transaccional Inmutable
  const updatedDevice: Device = {
    ...device,
    lastKnownState: { ...newState }, // Snapshot limpio
    entityVersion: device.entityVersion + 1,
    updatedAt: now
  };

  // 4. Persistencia Source of Truth
  await deps.deviceRepository.saveDevice(updatedDevice);

  // 5. Difusión de Cambio de Estado (Best-effort Domain Event)
  try {
    const stateUpdatedEvent = createDeviceStateUpdatedEvent(
      { 
        deviceId: device.id, 
        homeId: device.homeId, 
        newState: { ...newState } 
      },
      correlationId,
      { idGenerator: deps.idGenerator, clock: deps.clock }
    );
    await deps.eventPublisher.publish(stateUpdatedEvent);
  } catch (_error) {
    // Silencio: El fallo del publicador no debe opacar el éxito de la persistencia del snapshot
  }

  // 6. Registro en Read Model (Best-effort activity log)
  try {
    await deps.activityLogRepository.saveActivity({
      timestamp: now,
      deviceId: device.id,
      type: 'STATE_CHANGED',
      description: `Device state updated to ${JSON.stringify(newState)}`,
      data: { ...newState }
    });
  } catch (_error) {
    // El fallo en el log de actividad no debe revertir la sincronización del estado principal
  }
}
