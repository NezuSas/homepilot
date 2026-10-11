import { DateTime } from 'luxon';

export interface AutomationRule {
  userId?: string;
  sharedUserIds?: string[];
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  trigger: {
    type: 'device_state_changed' | 'time';
    deviceId?: string;
    stateKey?: string;
    expectedValue?: string;
    time?: string;
    timeLocal?: string;
    timezone?: string;
    timeUTC?: string;
    days?: number[];
    dateLocal?: string;
  };
  action: {
    type: 'device_command' | 'execute_scene';
    targetDeviceId?: string;
    command?: string;
    sceneId?: string;
  };
}

export interface AutomationScene {
  id: string;
  name: string;
  actions?: { deviceId: string; command: string }[];
}

export interface ActiveTimer {
  rule: AutomationRule;
  remainingMinutes: number;
}

export const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

/** Enabled one-shot time rules that have not fired yet, soonest first. */
export function getActiveTimers(rules: AutomationRule[], reference: DateTime): ActiveTimer[] {
  return rules.flatMap((rule) => {
    if (!rule.enabled || rule.trigger.type !== 'time' || !rule.trigger.dateLocal || !rule.trigger.timeLocal) return [];
    const scheduledAt = DateTime.fromFormat(`${rule.trigger.dateLocal} ${rule.trigger.timeLocal}`, 'yyyy-MM-dd HH:mm', { zone: rule.trigger.timezone });
    if (!scheduledAt.isValid || scheduledAt.toMillis() <= reference.toMillis()) return [];
    return [{ rule, remainingMinutes: Math.max(1, Math.ceil(scheduledAt.diff(reference, 'minutes').minutes)) }];
  }).sort((left, right) => left.remainingMinutes - right.remainingMinutes);
}
