import { DeviceDriver } from './DeviceDriver';

/**
 * Registry encargado de gestionar y resolver drivers de dispositivos
 * basados en su fuente de integración (integrationSource).
 */
export interface DeviceDriverRegistry {
  /**
   * Registra un driver para una fuente de integración específica.
   */
  register(integrationSource: string, driver: DeviceDriver): void;

  /**
   * Resuelve el driver adecuado para la fuente de integración dada.
   * Debe fallar explícitamente si no existe un driver compatible.
   */
  resolve(integrationSource: string): DeviceDriver;
}

/**
 * Error lanzado cuando no se encuentra un driver para una integración.
 */
export class DriverNotFoundError extends Error {
  constructor(public readonly integrationSource: string) {
    super(`No se encontró un driver registrado para la fuente de integración: ${integrationSource}`);
    this.name = 'DriverNotFoundError';
  }
}
