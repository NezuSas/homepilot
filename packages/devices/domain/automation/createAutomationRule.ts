import { AutomationRule, AutomationTrigger, AutomationAction } from './types';
import { InvalidAutomationRuleError, AutomationLoopError } from '../errors';
import { IdGenerator } from '../../../shared/domain/types';

export interface CreateAutomationRulePayload {
  homeId: string;
  userId: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
}

/**
 * Factoría pura para inicializar reglas de automatización.
 * Implementa validaciones de integridad y prevención de bucles recursivos básicos en el Edge.
 */
export function createAutomationRule(
  payload: CreateAutomationRulePayload,
  idGenerator: IdGenerator
): AutomationRule {
  // Validaciones de campos obligatorios
  if (!payload.homeId || payload.homeId.trim() === '') throw new InvalidAutomationRuleError('homeId');
  if (!payload.userId || payload.userId.trim() === '') throw new InvalidAutomationRuleError('userId');
  if (!payload.name || payload.name.trim() === '') throw new InvalidAutomationRuleError('name');
  
  if (!payload.trigger.deviceId || payload.trigger.deviceId.trim() === '') throw new InvalidAutomationRuleError('trigger.deviceId');
  if (!payload.trigger.stateKey || payload.trigger.stateKey.trim() === '') throw new InvalidAutomationRuleError('trigger.stateKey');
  
  if (!payload.action.targetDeviceId || payload.action.targetDeviceId.trim() === '') throw new InvalidAutomationRuleError('action.targetDeviceId');
  if (!payload.action.command) throw new InvalidAutomationRuleError('action.command');

  // Prevención de auto-bucle básico (según spec AC5)
  // En V1 restringimos que el trigger y target sean el mismo dispositivo para evitar recursión infinita simple.
  if (payload.trigger.deviceId === payload.action.targetDeviceId) {
    throw new AutomationLoopError();
  }

  return Object.freeze({
    id: idGenerator.generate(),
    homeId: payload.homeId.trim(),
    userId: payload.userId.trim(),
    name: payload.name.trim(),
    enabled: true,
    trigger: Object.freeze({ ...payload.trigger }),
    action: Object.freeze({ ...payload.action })
  });
}
