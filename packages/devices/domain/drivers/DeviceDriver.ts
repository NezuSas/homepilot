import { Device } from '../types';
import { DeviceCommandV1 } from '../commands';

/**
 * Contexto de ejecución para el driver (ej. correlación, metadatos del usuario).
 */
export interface DeviceDriverContext {
  userId: string;
  correlationId: string;
  isAutomation?: boolean;
}

/**
 * Representa un comando normalizado que el driver puede interpretar.
 */
export interface DeviceDriverCommand {
  name: DeviceCommandV1;
  params?: Record<string, unknown>;
}

/**
 * Resultado de la ejecución de un comando.
 */
export interface DeviceDriverResult {
  success: boolean;
  newState?: Record<string, unknown>;
  error?: string;
}

/**
 * Contrato base para todo Driver de dispositivos en HomePilot.
 * Un driver es responsable de la comunicación física con la integración específica.
 */
export interface DeviceDriver {
  /**
   * Ejecuta un comando físico en el dispositivo.
   */
  executeCommand(
    device: Device,
    command: DeviceDriverCommand,
    context: DeviceDriverContext
  ): Promise<DeviceDriverResult>;

  /**
   * Obtiene el estado actual del dispositivo (polling o cache).
   */
  getState?(device: Device): Promise<Record<string, unknown>>;

  /**
   * Determina si este driver soporta el dispositivo dado.
   */
  supports(device: Device): boolean;
}
