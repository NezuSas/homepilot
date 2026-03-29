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
 * Orquesta monolíticamente la ejecución de Side-Effects (Comandos físicos) interceptando
 * reglas de Zero-Trust, inhabilitando mutaciones sobre entidades PENDING, asegurando el diccionario V1
 * y emitiendo los eventos correspondientes asincrónicamente al desenlace del dispatch empírico.
 */
export async function executeDeviceCommandUseCase(
  deviceId: string,
  command: string,
  userId: string,
  correlationId: string,
  deps: ExecuteDeviceCommandDependencies
): Promise<void> {
  // 1. Aserción ontológica de base: Existencia estática
  const device = await deps.deviceRepository.findDeviceById(deviceId);
  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // 2. Control de Acceso Zero-Trust: Propiedad transversal confirmada mediante Topología (403)
  await deps.topologyPort.validateHomeOwnership(device.homeId, userId);

  // 3. Regla Formativa: Un Device en Inbox no tiene parentesco Físico real u host para comandarlo (409)
  if (device.status === 'PENDING') {
    throw new DevicePendingStateError(deviceId);
  }

  // 4. Auditoría V1 Restrictiva: Filtrado puro de diccionario limitante (400)
  if (!isValidCommand(command)) {
    throw new InvalidDeviceCommandError(command);
  }

  // 5. VALIDAR CAPACIDADES (Nuevo Guardián de Hardware V1)
  // Verificamos si el hardware físico del dispositivo soporta la acción solicitada.
  // Rechazamos de forma determinista antes de tocar el dispatcher o ensuciar el log.
  if (!canDeviceExecuteCommand(device.type, command)) {
    throw new UnsupportedCommandError(device.type, command);
  }

  // 6. DESPACHAR COMANDO (Infraestructura) - Side-Effect Puro (202 / 502)
  try {
    // El try-catch principal envuelve el despacho físico para aislar su resultado técnico
    await deps.dispatcherPort.dispatch(device.id, command);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Unknown integration error';
    
    // Intento de publicación de evento de fallo: se absorbe cualquier error interno del publisher
    try {
      const failedEvent = createDeviceCommandFailedEvent(
        { deviceId: device.id, homeId: device.homeId, command, reason },
        correlationId,
        { idGenerator: deps.idGenerator, clock: deps.clock }
      );
      await deps.eventPublisher.publish(failedEvent);
    } catch (_pubErr: unknown) {
      // Silencio: El error del publisher no debe opacar el error de dispatch real
    }

    // Registro en el log de actividad (Best-effort observability)
    try {
      await deps.activityLogRepository.saveActivity({
        timestamp: deps.clock.now(),
        deviceId: device.id,
        type: 'COMMAND_FAILED',
        description: `Command ${command} failed. Reason: ${reason}`,
        data: { command, reason }
      });
    } catch (_logErr: unknown) {
      // Silencio: El error del historial no debe opacar el error técnico de integración
    }

    throw new DispatchIntegrationError(device.id, reason);
  }

  // 6. Éxito: Notificación de despacho exitoso (Best-effort publishing)
  const now = deps.clock.now();
  try {
    const dispatchedEvent = createDeviceCommandDispatchedEvent(
      { deviceId: device.id, homeId: device.homeId, command },
      correlationId,
      { idGenerator: deps.idGenerator, clock: deps.clock }
    );
    await deps.eventPublisher.publish(dispatchedEvent);
  } catch (_pubErr: unknown) {
    // Silencio: Si falla la telemetría de éxito, el caso de uso sigue siendo exitoso
  }

  // Registro en el log de actividad de éxito (Best-effort)
  try {
    await deps.activityLogRepository.saveActivity({
      timestamp: now,
      deviceId: device.id,
      type: 'COMMAND_DISPATCHED',
      description: `Command ${command} dispatched correctly to gateway.`,
      data: { command }
    });
  } catch (_logErr: unknown) {
    // Silencio
  }
}
