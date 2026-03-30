import { AutomationRuleRepository } from '../../../domain/repositories/AutomationRuleRepository';
import { TopologyReferencePort } from '../../ports/TopologyReferencePort';
import { AutomationRuleNotFoundError } from '../../errors';

/**
 * Caso de uso para eliminar una regla de automatización.
 * Verifica la existencia de la regla y el permiso del usuario sobre el hogar dueño de la misma.
 */
export async function deleteAutomationRuleUseCase(
  ruleId: string,
  userId: string,
  deps: {
    automationRuleRepository: AutomationRuleRepository;
    topologyReferencePort: TopologyReferencePort;
  }
): Promise<void> {
  // 1. Buscar la regla para validar su existencia y origen
  const rule = await deps.automationRuleRepository.findById(ruleId);
  if (!rule) {
    throw new AutomationRuleNotFoundError(ruleId);
  }

  // 2. Validar que el solicitante es dueño del hogar donde reside la regla
  await deps.topologyReferencePort.validateHomeOwnership(rule.homeId, userId);

  // 3. Eliminación física delegada al repositorio
  await deps.automationRuleRepository.delete(ruleId);
}
