import { Device, assignDeviceToRoom } from '../domain';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceEventPublisher, createDeviceAssignedToRoomEvent } from '../domain/events';
import { IdGenerator, Clock } from '../../shared/domain/types';
import { DeviceNotFoundError } from './errors';
import { TopologyReferencePort } from './ports/TopologyReferencePort';

export interface AssignDeviceUseCaseDependencies {
  deviceRepository: DeviceRepository;
  eventPublisher: DeviceEventPublisher;
  topologyPort: TopologyReferencePort;
  idGenerator: IdGenerator;
  clock: Clock;
}

/**
 * Operador de asignación funcional, ejecutando el flujo central del modelo transaccional Topológico.
 */
export async function assignDeviceUseCase(
  deviceId: string,
  roomId: string,
  userId: string,
  correlationId: string,
  deps: AssignDeviceUseCaseDependencies
): Promise<Device> {
  const device = await deps.deviceRepository.findDeviceById(deviceId);

  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  // Validación NFR-05 transversal restrictiva (Zero-Trust) acatando estrictamente el Documento de Especificación:
  
  // 1. El emisor logueado en Gateway debe ser el dueño titular genuino del hogar de origen del Dispositivo.
  await deps.topologyPort.validateHomeOwnership(device.homeId, userId);
  
  // 2. El roomId dictado como destino debe pertenecer matemáticamente al mismo hogar matriz idéntico al del Dispositivo.
  await deps.topologyPort.validateRoomBelongsToHome(roomId, device.homeId);

  const updatedDevice = assignDeviceToRoom(device, roomId, deps.clock);

  await deps.deviceRepository.saveDevice(updatedDevice);

  const assignEvent = createDeviceAssignedToRoomEvent(
    {
      deviceId: updatedDevice.id,
      roomId: roomId, // Referencia segura estática eliminando dependencias de cast transitivas
      previousState: 'PENDING'
    },
    correlationId,
    { idGenerator: deps.idGenerator, clock: deps.clock }
  );

  try {
    await deps.eventPublisher.publish(assignEvent);
  } catch {
    // Tolerancia a fallos resuelta estáticamente y en silencio.
  }

  return updatedDevice;
}
