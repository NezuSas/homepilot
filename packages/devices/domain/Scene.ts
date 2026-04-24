import { DeviceCommandV1, DeviceCommandRequest } from './commands';

/**
 * SceneAction
 *
 * Acción individual dentro de una escena.
 * Soporta comandos legacy (string) y parametrizados (DeviceCommandRequest).
 *
 * delayMs y continueOnFailure solo tienen efecto en modo "sequential".
 */
export interface SceneAction {
  deviceId: string;
  command: DeviceCommandV1 | DeviceCommandRequest;
  /** Tiempo de espera (ms) antes de ejecutar esta acción. Solo en modo sequential. */
  delayMs?: number;
  /** Si true, continúa al siguiente paso aunque este falle. Solo en modo sequential. */
  continueOnFailure?: boolean;
}

/**
 * Scene
 *
 * executionMode:
 * - "parallel" (default / sin campo): comportamiento clásico — todas las acciones se lanzan juntas.
 * - "sequential": las acciones se ejecutan en orden estricto, respetando delayMs y continueOnFailure.
 *
 * No se modifica el schema de la tabla scenes. executionMode se persiste dentro del JSON de actions
 * a nivel de Scene, no de acción.
 */
export interface Scene {
  id: string;
  homeId: string;
  roomId: string | null;
  name: string;
  actions: SceneAction[];
  executionMode?: 'sequential' | 'parallel';
  createdAt: string;
  updatedAt: string;
}
