import { matchesStateComparison, validateStateComparison } from '../../domain/automation/stateComparison';
import { createAutomationRule } from '../../domain/automation/createAutomationRule';
import { updateAutomationRule } from '../../domain/automation/updateAutomationRule';
import type { DeviceStateTrigger } from '../../domain/automation/types';

describe('Feature: PLC measurement automation (AC27)', () => {
  const trigger: DeviceStateTrigger = { type: 'device_state_changed', deviceId: 'sensor', stateKey: 'value', expectedValue: 30, comparison: 'gt' };
  it.each([['gt', 31, true], ['gt', 30, false], ['gte', 30, true], ['lt', 29, true], ['lte', 30, true], ['eq', '30', true]] as const)('Scenario: %s compares a real measurement', (comparison, value, expected) => {
    expect(matchesStateComparison({ ...trigger, comparison }, value)).toBe(expected);
  });
  it.each([null, undefined, '', ' ', false, NaN, Infinity, 'unavailable'])('Scenario: Invalid current value %s never matches a numeric trigger', value => {
    expect(matchesStateComparison(trigger, value)).toBe(false);
  });
  it('Scenario: Create and edit preserve numeric comparison and historical equality', () => {
    const rule = createAutomationRule({ homeId: 'home', userId: 'user', name: 'Hot', trigger, action: { type: 'device_command', targetDeviceId: 'fan', command: 'turn_on' } }, { generate: () => 'rule' });
    expect(rule.trigger).toEqual(trigger);
    expect(updateAutomationRule(rule, { name: 'Changed' }).trigger).toEqual(trigger);
    expect(matchesStateComparison({ ...trigger, comparison: undefined, expectedValue: 'on' }, 'on')).toBe(true);
    expect(() => updateAutomationRule(rule, { trigger: { ...trigger, expectedValue: false } })).toThrow('finite number');
    expect(() => validateStateComparison({ type: 'compound', operator: 'AND', conditions: [trigger, { ...trigger, expectedValue: Infinity }] })).toThrow();
  });
});
