import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { AutomationRule } from '../../domain/automation/types';

/**
 * Adaptador de persistencia volátil para las reglas de automatización.
 * Diseñado para ejecución en el Edge y pruebas de integración rápidas.
 *
 * save() funciona como upsert: crea la regla si no existe o la reemplaza completamente si ya existe.
 * No se necesita un método update() separado — Map.set() es idempotente y determinista.
 *
 * Garantías de inmutabilidad:
 * - La copia almacenada internamente y todas las copias retornadas son profundamente congeladas.
 * - No se exponen referencias mutables al estado interno.
 */
export class InMemoryAutomationRuleRepository implements AutomationRuleRepository {
  private readonly rules: Map<string, AutomationRule> = new Map();

  /**
   * Guarda o reemplaza una regla de forma atómica (upsert).
   * Si ya existe una regla con el mismo id, es reemplazada completamente.
   */
  async save(rule: AutomationRule): Promise<void> {
    // Almacenamos una copia congelada en profundidad para evitar mutaciones externas
    this.rules.set(rule.id, this.freeze(rule));
  }

  async findById(id: string): Promise<AutomationRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;
    // Retornar copia congelada para evitar que el llamador mute el estado interno
    return this.freeze(rule);
  }

  async findByTriggerDevice(deviceId: string): Promise<ReadonlyArray<AutomationRule>> {
    const matching: AutomationRule[] = [];

    // El engine solo debe evaluar reglas habilitadas, el filtro ocurre aquí como optimización
    for (const rule of this.rules.values()) {
      if (rule.trigger.deviceId === deviceId && rule.enabled) {
        matching.push(this.freeze(rule));
      }
    }

    return Object.freeze(matching);
  }

  async findByHomeId(homeId: string): Promise<ReadonlyArray<AutomationRule>> {
    const homeRules: AutomationRule[] = [];

    for (const rule of this.rules.values()) {
      if (rule.homeId === homeId) {
        homeRules.push(this.freeze(rule));
      }
    }

    return Object.freeze(homeRules);
  }

  async findAll(): Promise<ReadonlyArray<AutomationRule>> {
    const allRules: AutomationRule[] = [];
    for (const rule of this.rules.values()) {
      allRules.push(this.freeze(rule));
    }
    return Object.freeze(allRules);
  }

  async delete(id: string): Promise<void> {
    // Eliminación silenciosa si la regla no existe, patrón consistente con adaptadores InMemory
    this.rules.delete(id);
  }

  /**
   * Congela profundamente la entidad: top-level, trigger y action.
   * Garantiza que ningún consumidor pueda mutar el estado almacenado internamente.
   */
  private freeze(rule: AutomationRule): AutomationRule {
    return Object.freeze({
      ...rule,
      trigger: Object.freeze({ ...rule.trigger }),
      action: Object.freeze({ ...rule.action })
    });
  }
}
