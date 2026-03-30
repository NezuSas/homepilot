import { createAutomationRule } from '../../domain/automation/createAutomationRule';
import { InvalidAutomationRuleError, AutomationLoopError } from '../../domain/errors';

describe('Automation Domain: createAutomationRule', () => {
  const idGen = { generate: () => 'rule-test-id' };

  const validTrigger = {
    deviceId: 'sensor-1',
    stateKey: 'contact',
    expectedValue: 'open'
  };

  const validAction = {
    targetDeviceId: 'light-1',
    command: 'turn_on' as const
  };

  it('AC1: debe crear una regla válida con todos los campos y aplicar trimming al nombre', () => {
    const rule = createAutomationRule({
      homeId: 'home-1',
      userId: 'user-1',
      name: '  My Rule  ',
      trigger: validTrigger,
      action: validAction
    }, idGen);

    expect(rule.id).toBe('rule-test-id');
    expect(rule.name).toBe('My Rule');
    expect(rule.enabled).toBe(true);
    expect(rule.trigger.deviceId).toBe('sensor-1');
  });

  it('debe fallar si el nombre está vacío o solo tiene espacios', () => {
    expect(() => createAutomationRule({
      homeId: 'home-1',
      userId: 'user-1',
      name: '   ',
      trigger: validTrigger,
      action: validAction
    }, idGen)).toThrow(InvalidAutomationRuleError);
  });

  it('AC5: debe prevenir la creación de una regla circular en el mismo dispositivo', () => {
    expect(() => createAutomationRule({
      homeId: 'home-1',
      userId: 'user-1',
      name: 'Auto Loop',
      trigger: { ...validTrigger, deviceId: 'light-1' },
      action: { ...validAction, targetDeviceId: 'light-1' }
    }, idGen)).toThrow(AutomationLoopError);
  });

  it('debe permitir expectedValue de tipo boolean, number y string', () => {
    const ruleBool = createAutomationRule({
      homeId: 'h1', userId: 'u1', name: 'N',
      trigger: { ...validTrigger, expectedValue: true },
      action: validAction
    }, idGen);
    expect(typeof ruleBool.trigger.expectedValue).toBe('boolean');

    const ruleNum = createAutomationRule({
      homeId: 'h1', userId: 'u1', name: 'N',
      trigger: { ...validTrigger, expectedValue: 42 },
      action: validAction
    }, idGen);
    expect(typeof ruleNum.trigger.expectedValue).toBe('number');

    const ruleStr = createAutomationRule({
      homeId: 'h1', userId: 'u1', name: 'N',
      trigger: { ...validTrigger, expectedValue: 'on' },
      action: validAction
    }, idGen);
    expect(typeof ruleStr.trigger.expectedValue).toBe('string');
  });
});
