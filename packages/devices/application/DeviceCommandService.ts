import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1, DeviceCommandRequest } from '../domain/commands';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceDriverRegistry } from '../domain/drivers/DeviceDriverRegistry';
import { DeviceDriverContext } from '../domain/drivers/DeviceDriver';
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

  public async dispatch(deviceId: string, command: DeviceCommandV1 | DeviceCommandRequest): Promise<void> {
    const device = await this.deviceRepository.findDeviceById(deviceId);
    if (!device) {
      throw new Error(`Dispositivo ${deviceId} no encontrado`);
    }

    // Normalizar comando para soportar llamadas legacy (string) y nuevas (DeviceCommandRequest)
    const normalizedCommand: DeviceCommandRequest = typeof command === 'string' 
      ? { name: command } 
      : command;

    // 1. Resolver el driver basado en integrationSource
    const driver = this.driverRegistry.resolve(device.integrationSource);

    // 2. Construir contexto de ejecución con soporte para metadatos
    const context: DeviceDriverContext = {
      userId: normalizedCommand.metadata?.userId || 'system',
      correlationId: normalizedCommand.metadata?.correlationId || `device-command:${deviceId}:${normalizedCommand.name}`
    };

    // 3. Ejecutar el comando a través del driver
    const result = await driver.executeCommand(
      device,
      { 
        name: normalizedCommand.name, 
        params: normalizedCommand.params 
      },
      context
    );

    if (!result.success) {
      throw new Error(result.error || `Error desconocido al ejecutar ${normalizedCommand.name} en ${device.integrationSource}`);
    }

    // 4. Sincronización optimista si el driver devuelve un nuevo estado
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
