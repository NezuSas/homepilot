import { AutomationRule } from '../automation/types';

/**
 * Puerto de persistencia para el Motor de Automatización.
 * Permite gestionar el ciclo de vida de las reglas y consultarlas por disparador.
 */
export interface AutomationRuleRepository {
  /** Guarda o actualiza una regla */
  save(rule: AutomationRule): Promise<void>;
  
  /** Busca una regla por ID único */
  findById(id: string): Promise<AutomationRule | null>;
  
  /** Encuentra todas las reglas que dependen de un dispositivo disparador específico */
  findByTriggerDevice(deviceId: string): Promise<ReadonlyArray<AutomationRule>>;
  
  /** Lista todas las reglas configuradas para un hogar */
  findByHomeId(homeId: string): Promise<ReadonlyArray<AutomationRule>>;
  
  /** Elimina una regla del sistema */
  delete(id: string): Promise<void>;
}
