import type { AutomationAction, AutomationRule } from '../../../devices/domain/automation/types';

/**
 * Reglas puras previas a ejecutar la acción de una regla.
 */

/** Proyecta un comando on/off al estado esperado; otros comandos no tienen proyección. */
export function projectCommandToState(command: string): string | null {
  if (command === 'turn_on') return 'on';
  if (command === 'turn_off') return 'off';
  return null;
}

/** Clave de la caché de prevención de bucles para una regla y su comando. */
export function createLoopPreventionKey(
  rule: AutomationRule,
  action: Extract<AutomationAction, { type: 'device_command' }>
): string {
  const trigger = rule.trigger.type === 'device_state_changed' ? rule.trigger : null;
  const expectedValue = trigger ? String(trigger.expectedValue) : 'compound';
  return [rule.id, action.targetDeviceId, action.command, expectedValue].join(':');
}
