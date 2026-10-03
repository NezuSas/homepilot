import type { AutomationTrigger, DeviceStateTrigger } from './types';
import { InvalidAutomationRuleError } from '../errors';

function numeric(value: unknown): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

/** Optional JSON extension; historical rules retain their string equality. */
export function validateStateComparison(trigger: AutomationTrigger, depth = 0): void {
  if (depth > 16) throw new InvalidAutomationRuleError('trigger depth');
  if (trigger.type === 'compound') {
    for (const condition of trigger.conditions ?? []) validateStateComparison(condition, depth + 1);
  } else if (trigger.type === 'device_state_changed' && trigger.comparison !== undefined) {
    if (!['eq', 'gt', 'gte', 'lt', 'lte'].includes(trigger.comparison)) throw new InvalidAutomationRuleError('trigger.comparison');
    if (trigger.comparison !== 'eq' && numeric(trigger.expectedValue) === undefined) throw new InvalidAutomationRuleError('trigger.expectedValue (finite number required)');
  }
}

export function matchesStateComparison(trigger: DeviceStateTrigger, current: unknown): boolean {
  if (!trigger.comparison || trigger.comparison === 'eq') return String(current) === String(trigger.expectedValue);
  const value = numeric(current), expected = numeric(trigger.expectedValue);
  if (value === undefined || expected === undefined) return false;
  switch (trigger.comparison) {
    case 'gt': return value > expected;
    case 'gte': return value >= expected;
    case 'lt': return value < expected;
    case 'lte': return value <= expected;
    default: return false;
  }
}
