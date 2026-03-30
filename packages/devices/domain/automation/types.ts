import { DeviceCommandV1 } from '../commands';

/**
 * Representa el disparador de una regla basado en el cambio de estado de un dispositivo.
 */
export interface AutomationTrigger {
  readonly deviceId: string;
  readonly stateKey: string;
  readonly expectedValue: string | number | boolean;
}

/**
 * Representa la acción a ejecutar cuando se cumple el disparador.
 */
export interface AutomationAction {
  readonly targetDeviceId: string;
  readonly command: DeviceCommandV1;
}

/**
 * Entidad central de Automatización V1 (Borrador/Inmutable).
 * Define una relación IF-THEN entre dos estados/dispositivos dentro de un hogar.
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
