import { DeviceCommandDispatcherPort } from '../../application/ports/DeviceCommandDispatcherPort';
import { DeviceCommandV1 } from '../../domain/commands';

/**
 * Emulador efímero para validaciones de regresión inyectables bajo Memory Sandbox.
 * Simula el Gateway externo permitiendo inyectar fallos explícitos (Sad Paths).
 */
export class InMemoryDeviceCommandDispatcher implements DeviceCommandDispatcherPort {
  private shouldFailMode = false;

  async dispatch(deviceId: string, command: DeviceCommandV1): Promise<void> {
    if (this.shouldFailMode) {
      throw new Error(`Simulated physical gateway failure for device ${deviceId} executing ${command}`);
    }
    // Retorna promesa exitosa síncrona de manera vacía si no hay bandera (Happy Path)
    return Promise.resolve();
  }

  // Helper local heurístico para desatar simulaciones 502 explícitas en Unit/E2E
  forceFailureSimulation(shouldFail: boolean): void {
    this.shouldFailMode = shouldFail;
  }
}
