import { DateTime } from 'luxon';
import { matchesStateComparison } from '../../../devices/domain/automation/stateComparison';
import type {
  AutomationTrigger,
  CompoundTrigger,
  DeviceStateTrigger,
  TimeTrigger,
} from '../../../devices/domain/automation/types';
import type { SystemStateChangeEvent } from '../../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

/**
 * Evaluación pura de disparadores de automatización (estado de dispositivo,
 * horario y compuestos). No accede a repositorios ni a efectos externos.
 */

export function resolveStateValue(
  state: Record<string, unknown> | null | undefined,
  stateKey: string
): unknown {
  if (!state) return undefined;
  if (stateKey === 'state') return state.state ?? state['state'];
  if (state.attributes && typeof state.attributes === 'object') {
    return (state.attributes as Record<string, unknown>)[stateKey];
  }
  return state[stateKey];
}

export function matchDeviceStateTrigger(
  trigger: DeviceStateTrigger,
  event: SystemStateChangeEvent
): boolean {
  if (trigger.deviceId !== event.deviceId) return false;
  const state = event.newState as Record<string, unknown>;
  if (state.available === false || state.stale === true || state.state === 'unavailable' || resolveStateValue(state, 'available') === false || resolveStateValue(state, 'stale') === true) return false;

  const currentValue = resolveStateValue(
    event.newState as Record<string, unknown>,
    trigger.stateKey
  );
  return matchesStateComparison(trigger, currentValue);
}

export function matchTimeTrigger(
  trigger: TimeTrigger,
  baseMoment: DateTime,
  systemTimezone: string
): boolean {
  const luxonToRuleDay = (lx: number): number => (lx === 7 ? 0 : lx);

  // STRATEGY 1: Local Rule (timeLocal + timezone)
  if (trigger.timeLocal) {
    const targetTz = trigger.timezone || systemTimezone;
    const localMoment = baseMoment.setZone(targetTz);

    const timeMatches = localMoment.toFormat('HH:mm') === trigger.timeLocal;
    const localDay = luxonToRuleDay(localMoment.weekday);
    const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(localDay);
    const dateMatches = !trigger.dateLocal || localMoment.toISODate() === trigger.dateLocal;

    return timeMatches && dayMatches && dateMatches;
  }

  // STRATEGY 2: UTC Rule (timeUTC)
  if (trigger.timeUTC) {
    const timeMatches = baseMoment.toFormat('HH:mm') === trigger.timeUTC;
    const utcDay = luxonToRuleDay(baseMoment.weekday);
    const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(utcDay);

    return timeMatches && dayMatches;
  }

  // STRATEGY 3: Legacy/Fallthrough Rule (deprecated time field)
  if (trigger.time) {
    const localMoment = baseMoment.setZone(systemTimezone);
    const timeMatches = localMoment.toFormat('HH:mm') === trigger.time;
    const localDay = luxonToRuleDay(localMoment.weekday);
    const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(localDay);

    return timeMatches && dayMatches;
  }

  return false;
}

export async function evaluateCompound(
  trigger: CompoundTrigger,
  event: SystemStateChangeEvent | null,
  baseMoment: DateTime | null,
  systemTimezone: string | null
): Promise<boolean> {
  const { operator, conditions } = trigger;

  const evalFn = async (sub: AutomationTrigger): Promise<boolean> => {
    if (sub.type === 'device_state_changed') {
      if (!event) return false;
      return matchDeviceStateTrigger(sub as DeviceStateTrigger, event);
    }
    if (sub.type === 'time') {
      if (baseMoment === null || systemTimezone === null) return false;
      return matchTimeTrigger(sub as TimeTrigger, baseMoment, systemTimezone);
    }
    if (sub.type === 'compound') {
      return evaluateCompound(sub as CompoundTrigger, event, baseMoment, systemTimezone);
    }
    return false;
  };

  if (operator === 'AND') {
    for (const sub of conditions) {
      if (!(await evalFn(sub))) return false;
    }
    return true;
  }

  // OR
  for (const sub of conditions) {
    if (await evalFn(sub)) return true;
  }
  return false;
}
