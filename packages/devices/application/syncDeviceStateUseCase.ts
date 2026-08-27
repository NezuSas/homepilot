import { Device } from '../domain/types';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceEventPublisher } from '../domain/events/DeviceEventPublisher';
import { ActivityLogRepository } from '../domain/repositories/ActivityLogRepository';
import { isStateIdentical } from '../domain/state';
import { normalizeMediaPlaybackState } from '../domain/MediaPlayerPlaybackState';
import { createDeviceStateUpdatedEvent } from '../domain/events/factories';
import { DeviceNotFoundError } from './errors';
import { IdGenerator, Clock } from '../../shared/domain/types';
import { isDiagnosticLoggingEnabled } from '../../shared/config/runtimeEnvironment';

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

  const now = deps.clock.now();
  const normalizedState = normalizeMediaPlaybackState(device.lastKnownState, newState, now);

  // 2. Evaluación de Idempotencia (V1: Flat Object Equality)
  // Si el estado reportado es idéntico al actual, abortamos sin efectos secundarios
  if (isStateIdentical(device.lastKnownState, normalizedState)) {
    return;
  }

  // 3. Mutación Transaccional Inmutable
  const updatedDevice: Device = {
    ...device,
    lastKnownState: { ...normalizedState }, // Snapshot limpio
    entityVersion: device.entityVersion + 1,
    updatedAt: now
  };

  // 4. Persistencia Source of Truth
  const t_save = Date.now();
  await deps.deviceRepository.saveDevice(updatedDevice);
  if (isDiagnosticLoggingEnabled()) {
    console.debug(`[syncDeviceStateUseCase] deviceRepository.saveDevice took ${Date.now() - t_save}ms`);
  }

  // 5. Difusión de Cambio de Estado (Best-effort Domain Event)
  try {
    const stateUpdatedEvent = createDeviceStateUpdatedEvent(
      { 
        deviceId: device.id, 
        homeId: device.homeId, 
        newState: { ...normalizedState }
      },
      correlationId,
      { idGenerator: deps.idGenerator, clock: deps.clock }
    );
    const t_pub = Date.now();
    await deps.eventPublisher.publish(stateUpdatedEvent);
    if (isDiagnosticLoggingEnabled()) {
      console.debug(`[syncDeviceStateUseCase] eventPublisher.publish took ${Date.now() - t_pub}ms`);
    }
  } catch (_error) {
    // Silencio: El fallo del publicador no debe opacar el éxito de la persistencia del snapshot
  }

  // 6. Registro en Read Model (Best-effort activity log)
  try {
    const t_log = Date.now();
    await deps.activityLogRepository.saveActivity({
      timestamp: now,
      deviceId: device.id,
      type: 'STATE_CHANGED',
      description: `Device state updated to ${JSON.stringify(normalizedState)}`,
      data: { ...normalizedState, state: JSON.stringify(normalizedState) }
    });
    if (isDiagnosticLoggingEnabled()) {
      console.debug(`[syncDeviceStateUseCase] activityLogRepository.saveActivity took ${Date.now() - t_log}ms`);
    }
  } catch (_error) {
    // El fallo en el log de actividad no debe revertir la sincronización del estado principal
  }
}
