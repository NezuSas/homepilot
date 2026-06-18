import { DeviceCommandDispatcherPort } from './ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1, DeviceCommandRequest } from '../domain/commands';
import { DeviceRepository } from '../domain/repositories/DeviceRepository';
import { DeviceDriverRegistry } from '../domain/drivers/DeviceDriverRegistry';
import { DeviceDriverContext } from '../domain/drivers/DeviceDriver';
import { syncDeviceStateUseCase, SyncDeviceStateDependencies } from './syncDeviceStateUseCase';
import { validateDeviceCommand } from '../domain/CommandCapabilityValidator';

/**
 * DeviceCommandService
 * 
 * Orquestador central para la ejecución de comandos en dispositivos.
 * Resuelve el driver adecuado y gestiona la sincronización de estado optimista.
 * 
 * Ahora integra validación operativa basada en Device Capabilities V1.
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

    // 1. Normalizar comando para soportar llamadas legacy (string) y nuevas (DeviceCommandRequest)
    const normalizedCommand: DeviceCommandRequest = typeof command === 'string' 
      ? { name: command } 
      : command;

    // 2. Validar capacidades del dispositivo antes de intentar contactar con el driver físico
    const validation = validateDeviceCommand(device, normalizedCommand);
    if (!validation.valid) {
      throw new Error(validation.error || `Comando ${normalizedCommand.name} no soportado para este dispositivo.`);
    }

    // 3. Resolver el driver basado en integrationSource
    const driver = this.driverRegistry.resolve(device.integrationSource);

    // 4. Construir contexto de ejecución con soporte para metadatos
    const context: DeviceDriverContext = {
      userId: normalizedCommand.metadata?.userId || 'system',
      correlationId: normalizedCommand.metadata?.correlationId || `device-command:${deviceId}:${normalizedCommand.name}`
    };

    // 5. Ejecutar el comando a través del driver
    const t_driver = Date.now();
    const result = await driver.executeCommand(
      device,
      { 
        name: normalizedCommand.name, 
        params: normalizedCommand.params 
      },
      context
    );
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DeviceCommandService] driver.executeCommand took ${Date.now() - t_driver}ms`);
    }

    if (!result.success) {
      throw new Error(result.error || `Error desconocido al ejecutar ${normalizedCommand.name} en ${device.integrationSource}`);
    }

    // 6. Sincronización optimista si el driver devuelve un nuevo estado.
    // Esperamos su finalización para que la respuesta del comando nunca anteceda al snapshot persistido.
    if (result.newState) {
      const t_sync = Date.now();
      try {
        await syncDeviceStateUseCase(
          deviceId,
          result.newState,
          'device-command-service',
          this.syncDeps
        );
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[DeviceCommandService] syncDeviceStateUseCase took ${Date.now() - t_sync}ms`);
        }
      } catch (err: unknown) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[DeviceCommandService] syncDeviceStateUseCase failed:', err instanceof Error ? err.message : String(err));
        }
      }
    }
  }
}
