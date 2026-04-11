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
  
  // Validar Trigger
  if (payload.trigger.type === 'device_state_changed') {
    if (!payload.trigger.deviceId) throw new InvalidAutomationRuleError('trigger.deviceId');
    if (!payload.trigger.stateKey) throw new InvalidAutomationRuleError('trigger.stateKey');
  } else if (payload.trigger.type === 'time') {
    if (!payload.trigger.time) throw new InvalidAutomationRuleError('trigger.time');
    // Regex simple para HH:mm
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(payload.trigger.time)) {
      throw new InvalidAutomationRuleError('trigger.time (format HH:mm)');
    }
  }

  // Validar Action
  if (payload.action.type === 'device_command') {
    if (!payload.action.targetDeviceId) throw new InvalidAutomationRuleError('action.targetDeviceId');
    if (!payload.action.command) throw new InvalidAutomationRuleError('action.command');
  } else if (payload.action.type === 'execute_scene') {
    if (!payload.action.sceneId) throw new InvalidAutomationRuleError('action.sceneId');
  }

  // Prevención de auto-bucle básico (según spec AC5)
  if (payload.trigger.type === 'device_state_changed' && payload.action.type === 'device_command') {
    if (payload.trigger.deviceId === payload.action.targetDeviceId) {
      throw new AutomationLoopError();
    }
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
