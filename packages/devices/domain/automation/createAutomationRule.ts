import { AutomationRule, AutomationTrigger, AutomationAction } from './types';
import { InvalidAutomationRuleError, AutomationLoopError } from '../errors';
import { IdGenerator } from '../../../shared/domain/types';
import { TimeUtils } from '../../../shared/domain/utils/TimeUtils';

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
    const t = payload.trigger;
    const timeToValidate = t.timeLocal || t.time; // Soporte legacy en payload si es necesario
    
    if (!timeToValidate) throw new InvalidAutomationRuleError('trigger.timeLocal');
    if (!t.timezone) throw new InvalidAutomationRuleError('trigger.timezone');

    // Regex simple para HH:mm
    if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(timeToValidate)) {
      throw new InvalidAutomationRuleError('trigger.timeLocal (format HH:mm)');
    }

    // Calcular timeUTC si no viene o para asegurar consistencia server-side
    t.timeLocal = timeToValidate;
    t.timeUTC = TimeUtils.convertLocalToUTC(timeToValidate, t.timezone);
  } else if (payload.trigger.type === 'compound') {
    if (!payload.trigger.conditions || payload.trigger.conditions.length === 0) {
      throw new InvalidAutomationRuleError('trigger.conditions (at least one required)');
    }
    if (!['AND', 'OR', 'NOT'].includes(payload.trigger.operator)) {
      throw new InvalidAutomationRuleError('trigger.operator (must be AND, OR or NOT)');
    }
    if (payload.trigger.operator === 'NOT' && payload.trigger.conditions.length !== 1) {
      throw new InvalidAutomationRuleError('trigger.conditions (NOT requires exactly 1 condition)');
    }
    if (payload.trigger.operator !== 'NOT' && payload.trigger.conditions.length < 2) {
      throw new InvalidAutomationRuleError('trigger.conditions (AND/OR require at least 2 conditions)');
    }
  }

  // Validar Action
  if (payload.action.type === 'device_command') {
    if (!payload.action.targetDeviceId) throw new InvalidAutomationRuleError('action.targetDeviceId');
    if (!payload.action.command) throw new InvalidAutomationRuleError('action.command');
  } else if (payload.action.type === 'execute_scene') {
    if (!payload.action.sceneId) throw new InvalidAutomationRuleError('action.sceneId');
  } else if (payload.action.type === 'delay') {
    if (typeof payload.action.delaySeconds !== 'number' || payload.action.delaySeconds <= 0) {
      throw new InvalidAutomationRuleError('action.delaySeconds (must be a positive number)');
    }
    if (!payload.action.then) {
      throw new InvalidAutomationRuleError('action.then (required for delay action)');
    }
    if (!['device_command', 'execute_scene'].includes(payload.action.then.type)) {
      throw new InvalidAutomationRuleError('action.then.type (must be device_command or execute_scene)');
    }
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
