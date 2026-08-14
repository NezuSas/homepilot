import type { DeviceDriver, DeviceDriverCommand, DeviceDriverContext, DeviceDriverResult } from '../../../devices/domain/drivers/DeviceDriver';
import type { Device } from '../../../devices/domain/types';
import type { NativeCameraSourceRepository } from '../../../devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraDriverRegistry } from '../application/ports/NativeCameraDriverRegistry';
import type { NativeCameraEndpoint, NativeCameraStreamProfile, PtzVector } from '../application/ports/NativeCameraDriver';

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * DeviceDriver for `integrationSource: 'native-camera'` devices. Only handles
 * PTZ commands (`ptz_move`/`ptz_stop`) — snapshot/streaming media lives behind
 * `NativeCameraStreamingService`/`CameraRoutes`, not the generic command path.
 */
export class NativeCameraDeviceDriver implements DeviceDriver {
  constructor(
    private readonly nativeCameraSourceRepository: NativeCameraSourceRepository,
    private readonly driverRegistry: NativeCameraDriverRegistry
  ) {}

  public supports(device: Device): boolean {
    return device.integrationSource === 'native-camera';
  }

  public async executeCommand(
    device: Device,
    command: DeviceDriverCommand,
    _context: DeviceDriverContext
  ): Promise<DeviceDriverResult> {
    if (command.name !== 'ptz_move' && command.name !== 'ptz_stop') {
      return { success: false, error: `Comando ${command.name} no soportado para cámaras nativas` };
    }

    const source = this.nativeCameraSourceRepository.findByDeviceId(device.id);
    if (!source) {
      return { success: false, error: 'Fuente de cámara nativa no encontrada' };
    }
    if (!source.ptzSupported) {
      return { success: false, error: 'Esta cámara no soporta control PTZ' };
    }

    const driver = this.driverRegistry.resolve(source.sourceType);
    const endpoint: NativeCameraEndpoint = {
      host: source.host,
      onvifPort: source.onvifPort,
      rtspPort: source.rtspPort,
      username: source.username,
      password: source.password,
      rtspPath: source.rtspPath,
    };
    const profile: NativeCameraStreamProfile = {
      rtspPort: source.rtspPort,
      rtspPath: source.rtspPath,
      profileToken: source.profileToken,
      ptzConfigurationToken: source.ptzConfigurationToken,
      ptzSupported: source.ptzSupported,
    };

    try {
      if (command.name === 'ptz_move') {
        const vector: PtzVector = {
          pan: toNumber(command.params?.pan),
          tilt: toNumber(command.params?.tilt),
          zoom: toNumber(command.params?.zoom),
        };
        if (vector.pan === 0 && vector.tilt === 0 && vector.zoom === 0) {
          return { success: false, error: 'Debe especificar al menos un eje (pan/tilt/zoom)' };
        }
        if (!driver.movePtz) {
          return { success: false, error: 'El driver de esta cámara no implementa PTZ' };
        }
        await driver.movePtz(endpoint, profile, vector);
      } else {
        if (!driver.stopPtz) {
          return { success: false, error: 'El driver de esta cámara no implementa PTZ' };
        }
        await driver.stopPtz(endpoint, profile);
      }
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : 'Error PTZ desconocido' };
    }
  }
}
