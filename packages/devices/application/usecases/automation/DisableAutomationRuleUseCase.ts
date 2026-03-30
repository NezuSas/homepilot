import { AutomationRuleRepository } from '../../../domain/repositories/AutomationRuleRepository';
import { TopologyReferencePort } from '../../ports/TopologyReferencePort';
import { AutomationRule } from '../../../domain';
import { AutomationRuleNotFoundError } from '../../errors';

/**
 * Caso de uso: Deshabilitar una regla de automatización existente.
 *
 * Semántica: idempotente — si la regla ya está deshabilitada, la operación es considerada exitosa
 * sin producir errores ni efectos secundarios adicionales.
 *
 * Efecto en el motor: el AutomationEngine filtra por enabled:true en findByTriggerDevice,
 * por lo que una regla deshabilitada deja de evaluarse de forma inmediata en la siguiente invocación.
 *
 * Zero-Trust: se valida ownership del hogar antes de cualquier mutación.
 */
export async function disableAutomationRuleUseCase(
  ruleId: string,
  userId: string,
  deps: {
    automationRuleRepository: AutomationRuleRepository;
    topologyReferencePort: TopologyReferencePort;
  }
): Promise<AutomationRule> {
  // 1. Localizar la regla; falla explícitamente si no existe (AC8)
  const existing = await deps.automationRuleRepository.findById(ruleId);
  if (!existing) throw new AutomationRuleNotFoundError(ruleId);

  // 2. Validar ownership del hogar asignado a la regla (Zero-Trust, AC7)
  await deps.topologyReferencePort.validateHomeOwnership(existing.homeId, userId);

  // 3. Idempotencia: si ya está deshabilitada, retornar sin mutar ni re-persistir
  if (!existing.enabled) return existing;

  // 4. Construir nueva entidad congelada con enabled:false — el resto de campos permanece intacto
  const updated: AutomationRule = Object.freeze({ ...existing, enabled: false });

  // 5. Persistir mediante save() como upsert
  await deps.automationRuleRepository.save(updated);

  return updated;
}
