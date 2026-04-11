import { DeviceCommandV1 } from '../commands';

/**
 * Representa el disparador de una regla basado en el cambio de estado de un dispositivo.
 */
export interface DeviceStateTrigger {
  type: 'device_state_changed';
  deviceId: string;
  stateKey: string;
  expectedValue: string | number | boolean;
}

/**
 * Representa el disparador de una regla basado en una hora específica.
 */
export interface TimeTrigger {
  type: 'time';
  timeLocal: string;    // "HH:mm" (User Input)
  timezone: string;     // IANA Timezone, e.g. "America/Guayaquil"
  timeUTC: string;       // "HH:mm" (Server Processed)
  days?: number[];      // [0,1,2,3,4,5,6] - 0 is Sunday
  
  /** @deprecated use timeLocal and timeUTC */
  time?: string;
}

export type AutomationTrigger = DeviceStateTrigger | TimeTrigger;

/**
 * Representa la acción de ejecutar un comando sobre un dispositivo.
 */
export interface DeviceCommandAction {
  type: 'device_command';
  targetDeviceId: string;
  command: DeviceCommandV1;
}

/**
 * Representa la acción de ejecutar una escena guardada.
 */
export interface SceneAction {
  type: 'execute_scene';
  sceneId: string;
}

export type AutomationAction = DeviceCommandAction | SceneAction;

/**
 * Entidad central de Automatización V1 (Borrador/Inmutable).
 * Define una relación IF-THEN entre una condición y una acción.
 */
export interface AutomationRule {
  readonly id: string;
  readonly homeId: string;
  readonly userId: string; // ID del dueño original que configuró la regla
  readonly name: string;
  readonly enabled: boolean;
  readonly trigger: AutomationTrigger;
  readonly action: AutomationAction;
}
