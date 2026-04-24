import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../domain/commands';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceDriverRegistry } from '../domain/drivers/DeviceDriverRegistry';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from './syncDeviceStateUseCase';

/**
 * DeviceCommandService
 * 
 * Orquestador central para la ejecución de comandos en dispositivos.
 * Resuelve el driver adecuado y gestiona la sincronización de estado optimista.
 * 
 * Implementa DeviceCommandDispatcherPort para mantener compatibilidad con executeDeviceCommandUseCase.
 */
export class DeviceCommandService implements DeviceCommandDispatcherPort {
  constructor(
    private readonly deviceRepository: DeviceRepository,
    private readonly driverRegistry: DeviceDriverRegistry,
    private readonly syncDeps: SyncDeviceStateDependencies
  ) {}

  public async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) {
      throw new Error(`Dispositivo ${deviceId} no encontrado`);
    }

    // 1. Resolver el driver basado en integrationSource
    // Si no hay driver, DriverNotFoundError será lanzado (Fallo explícito solicitado)
    const driver = this.driverRegistry.resolve(device.integrationSource);

    // 2. Ejecutar el comando a través del driver
    const result = await driver.executeCommand(
      device,
      { name: command },
      { 
        // TODO: Obtener metadatos reales del comando cuando el puerto soporte params/metadata
        userId: 'system', 
        correlationId: `device-command:${deviceId}:${command}` 
      }
    );

    if (!result.success) {
      throw new Error(result.error || `Error desconocido al ejecutar ${command} en ${device.integrationSource}`);
    }

    // 3. Sincronización optimista si el driver devuelve un nuevo estado
    if (result.newState) {
      await syncDeviceStateUseCase(
        deviceId, 
        result.newState, 
        'device-command-service', 
        this.syncDeps
      );
    }
  }
}
