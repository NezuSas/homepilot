import { AutomationRuleRepository } from '../../../domain/repositories/AutomationRuleRepository';
import { TopologyReferencePort } from '../../ports/TopologyReferencePort';
import { AutomationRule } from '../../../domain';

/**
 * Caso de uso para listar todas las reglas de automatización de un hogar.
 * Requiere validación de ownership para asegurar la privacidad entre multi-tenants.
 */
export async function listAutomationRulesUseCase(
  homeId: string,
  userId: string,
  deps: {
    automationRuleRepository: AutomationRuleRepository;
    topologyReferencePort: TopologyReferencePort;
  }
): Promise<ReadonlyArray<AutomationRule>> {
  // 1. Validar que el usuario tiene acceso al hogar solicitado
  await deps.topologyReferencePort.validateHomeOwnership(homeId, userId);

  // 2. El hogar es compartido; la gestión y visibilidad de reglas no lo son.
  const rules = await deps.automationRuleRepository.findByHomeId(homeId);
  return rules.filter((rule) => rule.userId === userId);
}
