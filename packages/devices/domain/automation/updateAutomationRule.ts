import { AutomationRule, AutomationTrigger, AutomationAction } from './types';
import { InvalidAutomationRuleError, AutomationLoopError } from '../errors';

/**
 * Subset de campos que el dueño de la regla puede modificar.
 * Los campos de identidad (id, homeId, userId) son inmutables y se ignoran aunque lleguen en el payload.
 */
export interface UpdateAutomationRulePatch {
  readonly name?: string;
  readonly trigger?: AutomationTrigger;
  readonly action?: AutomationAction;
}

/**
 * Función pura de dominio para aplicar un patch parcial sobre una regla existente.
 */
export function updateAutomationRule(
  existing: AutomationRule,
  patch: UpdateAutomationRulePatch
): AutomationRule {
  // Resolver el nombre final aplicando trimming si viene en el patch
  const resolvedName = patch.name !== undefined
    ? patch.name.trim()
    : existing.name;

  // Validar que el nombre final no quede vacío tras el trimming
  if (resolvedName === '') {
    throw new InvalidAutomationRuleError('name');
  }

  // Resolver trigger y action finales (patch parcial: solo se reemplaza si viene en el payload)
  const resolvedTrigger = patch.trigger !== undefined
    ? Object.freeze({ ...patch.trigger })
    : existing.trigger;

  const resolvedAction = patch.action !== undefined
    ? Object.freeze({ ...patch.action })
    : existing.action;

  // Prevención de auto-bucle: solo aplica si el trigger es device y la accion es command
  if (resolvedTrigger.type === 'device_state_changed' && resolvedAction.type === 'device_command') {
    if (resolvedTrigger.deviceId === resolvedAction.targetDeviceId) {
      throw new AutomationLoopError();
    }
  }

  // Retornar nueva entidad inmutable
  return Object.freeze({
    id: existing.id,
    homeId: existing.homeId,
    userId: existing.userId,
    enabled: existing.enabled,
    name: resolvedName,
    trigger: resolvedTrigger,
    action: resolvedAction
  });
}
