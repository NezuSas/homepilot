import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { AutomationRule } from '../../domain/automation/types';

/**
 * Adaptador de persistencia volátil para las reglas de automatización.
 * Diseñado para ejecución en el Edge y pruebas de integración rápidas.
 * Garantiza la integridad de los datos mediante copias congeladas (Object.freeze).
 */
export class InMemoryAutomationRuleRepository implements AutomationRuleRepository {
  private rules: Map<string, AutomationRule> = new Map();

  async save(rule: AutomationRule): Promise<void> {
    // Almacenamiento hermético aislando apuntadores mediante una copia congelada
    this.rules.set(rule.id, Object.freeze({ ...rule }));
  }

  async findById(id: string): Promise<AutomationRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;
    return Object.freeze({ ...rule });
  }

  async findByTriggerDevice(deviceId: string): Promise<ReadonlyArray<AutomationRule>> {
    const matching: AutomationRule[] = [];
    
    // Filtramos solo reglas habilitadas que coincidan con el dispositivo disparador
    for (const rule of this.rules.values()) {
      if (rule.trigger.deviceId === deviceId && rule.enabled) {
        matching.push(Object.freeze({ ...rule }));
      }
    }
    
    return Object.freeze(matching);
  }

  async findByHomeId(homeId: string): Promise<ReadonlyArray<AutomationRule>> {
    const homeRules: AutomationRule[] = [];
    
    for (const rule of this.rules.values()) {
      if (rule.homeId === homeId) {
        homeRules.push(Object.freeze({ ...rule }));
      }
    }
    
    return Object.freeze(homeRules);
  }

  async delete(id: string): Promise<void> {
    // Eliminación silenciosa si la regla no existe, consistente con Adaptadores InMemory
    this.rules.delete(id);
  }
}
