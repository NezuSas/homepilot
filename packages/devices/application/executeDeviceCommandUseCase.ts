import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceEventPublisher } from '../domain/events/DeviceEventPublisher';
import { ActivityLogRepository } from '../domain/repositories/ActivityLogRepository';
import { TopologyReferencePort } from './ports/TopologyReferencePort';
import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';
import { 
  isValidCommand, 
  InvalidDeviceCommandError, 
  canDeviceExecuteCommand, 
  UnsupportedCommandError 
} from '../domain';
import { 
  DeviceNotFoundError, 
  DevicePendingStateError, 
  DispatchIntegrationError 
} from './errors';
import { 
  createDeviceCommandDispatchedEvent, 
  createDeviceCommandFailedEvent 
} from '../domain/events/factories';
import { IdGenerator, Clock } from '../../shared/domain/types';

export interface ExecuteDeviceCommandDependencies {
  deviceRepository: DeviceRepository;
  eventPublisher: DeviceEventPublisher;
  topologyPort: TopologyReferencePort;
  dispatcherPort: DeviceCommandDispatcherPort;
  activityLogRepository: ActivityLogRepository;
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Orquesta monolíticamente la ejecución de Side-Effects (Comandos físicos).
 * Implementa Zero-Trust, validación de capacidades y auditoría.
 */
export async function executeDeviceCommandUseCase(
  deviceId: string,
  command: string,
  userId: string,
  correlationId: string,
  deps: ExecuteDeviceCommandDependencies,
  options?: {
    customDescription?: string;
    isAutomation?: boolean;
    allowPendingManualExecution?: boolean;
  }
): Promise<void> {
  // 1. Localización y Validación de Existencia
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // 2. Control de Acceso Zero-Trust
  await deps.topologyPort.validateHomeOwnership(device.homeId, userId);

  // 3. Validación de Estado (No inbox/pending)
  // Se permite bypass explícito para comandos manuales desde la consola (Technical Inspector)
  if (device.status === 'PENDING' && !options?.allowPendingManualExecution) {
    throw new DevicePendingStateError(deviceId);
  }

  // 4. Validación de Diccionario V1
  if (!isValidCommand(command)) {
    throw new InvalidDeviceCommandError(command);
  }

  // 5. Validación de Capacidades (Hardware)
  if (!canDeviceExecuteCommand(device.type, command)) {
    throw new UnsupportedCommandError(device.type, command);
  }

  // 6. Ejecución del Efecto (Despacho físico)
  try {
    await deps.dispatcherPort.dispatch(device.id, command);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Unknown integration error';
    
    // Telemetría: Publicación del evento de fallo
    try {
      const failedEvent = createDeviceCommandFailedEvent(
        { deviceId: device.id, homeId: device.homeId, command, reason },
        correlationId,
        { idGenerator: deps.idGenerator, clock: deps.clock }
      );
      await deps.eventPublisher.publish(failedEvent);
    } catch (_pubErr) { /* silenciar */ }

    // Auditoría de Fallo (SOLO para comandos manuales)
    // Las automatizaciones son registradas por el AutomationEngine para evitar redundancia
    if (!options?.isAutomation) {
      try {
        await deps.activityLogRepository.saveActivity({
          timestamp: deps.clock.now(),
          deviceId: device.id,
          type: 'COMMAND_FAILED',
          description: `Command ${command} failed. Reason: ${reason}`,
          data: { command, reason, isAutomation: false }
        });
      } catch (_logErr) { /* silenciar */ }
    }

    throw new DispatchIntegrationError(device.id, reason);
  }

  // 7. Éxito: Registro y Telemetría
  const now = deps.clock.now();
  
  // Publicar evento de despacho exitoso
  try {
    const dispatchedEvent = createDeviceCommandDispatchedEvent(
      { deviceId: device.id, homeId: device.homeId, command },
      correlationId,
      { idGenerator: deps.idGenerator, clock: deps.clock }
    );
    await deps.eventPublisher.publish(dispatchedEvent);
  } catch (_pubErr) { /* silenciar */ }

  // Registro en el log de actividad (Audit Log)
  try {
    await deps.activityLogRepository.saveActivity({
      timestamp: now,
      deviceId: device.id,
      type: 'COMMAND_DISPATCHED',
      description: options?.customDescription || `Command ${command} dispatched correctly to gateway.`,
      data: { command, isAutomation: options?.isAutomation || false }
    });
  } catch (_logErr) { /* silenciar */ }
}
