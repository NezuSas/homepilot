import { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../packages/devices/domain/commands';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from '../../packages/devices/application/syncDeviceStateUseCase';
import { DeviceRepository } from '../../packages/devices/domain/repositories/DeviceRepository';

/**
 * Despachador de Comandos exclusivo para la Consola del Operador local.
 * 
 * Implementa el Puerto de Salida 'DeviceCommandDispatcherPort'.
 * Simula el efecto físico en el hardware reportando inmediatamente un cambio de estado
 * a través de 'syncDeviceStateUseCase', permitiendo que la UI sea reactiva en desarrollo.
 */
export class LocalConsoleCommandDispatcher implements DeviceCommandDispatcherPort {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly syncDeps: SyncDeviceStateDependencies,
    private readonly correlationId: string = 'local-console-sync'
  ) {}

  async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    console.log(`[LocalDispatcher] Despachando comando físico: ${command} para dispositivo: ${deviceId}`);

    // Simulación de Telemetría: 
    // Mapeamos el comando al estado esperado para que la consola local refleje el cambio.
    
    // 1. Obtener el estado actual
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) return;

    let newState: Record<string, unknown> = { ...device.lastKnownState };

    // 2. Determinar el nuevo estado basado en el comando V1
    switch (command) {
      case 'turn_on':
        newState = { ...newState, on: true };
        break;
      case 'turn_off':
        newState = { ...newState, on: false };
        break;
      case 'toggle':
        const currentStatus = device.lastKnownState?.on === true;
        newState = { ...newState, on: !currentStatus };
        break;
    }

    // 3. Sincronizar el estado (esto dispara eventos y actualiza la DB)
    console.log(`[LocalDispatcher] Simulando telemetría... Nuevo estado:`, newState);
    await syncDeviceStateUseCase(
      deviceId,
      newState,
      this.correlationId,
      this.syncDeps
    );
  }
}
