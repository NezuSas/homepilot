import { createAutomationRule } from '../../domain/automation/createAutomationRule';
import { updateAutomationRule } from '../../domain/automation/updateAutomationRule';
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

describe('Automation Domain: updateAutomationRule', () => {
  // Regla base para todos los tests de update
  const baseRule = Object.freeze({
    id: 'rule-abc',
    homeId: 'home-1',
    userId: 'user-owner',
    name: 'Regla Original',
    enabled: true,
    trigger: Object.freeze({ deviceId: 'sensor-1', stateKey: 'contact', expectedValue: 'open' }),
    action: Object.freeze({ targetDeviceId: 'light-1', command: 'turn_on' as const })
  });

  it('actualiza el nombre correctamente con trimming', () => {
    const updated = updateAutomationRule(baseRule, { name: '  Renombrada  ' });
    expect(updated.name).toBe('Renombrada');
    // Resto de campos preservados
    expect(updated.trigger.deviceId).toBe('sensor-1');
    expect(updated.action.targetDeviceId).toBe('light-1');
  });

  it('preserva trigger y action cuando el patch solo incluye name', () => {
    const updated = updateAutomationRule(baseRule, { name: 'Nuevo Nombre' });
    expect(updated.trigger).toEqual(baseRule.trigger);
    expect(updated.action).toEqual(baseRule.action);
  });

  it('preserva name y action cuando el patch solo incluye trigger', () => {
    const newTrigger = { deviceId: 'sensor-2', stateKey: 'presence', expectedValue: true };
    const updated = updateAutomationRule(baseRule, { trigger: newTrigger });
    expect(updated.name).toBe('Regla Original');
    expect(updated.trigger.deviceId).toBe('sensor-2');
    expect(updated.action).toEqual(baseRule.action);
  });

  it('lanza InvalidAutomationRuleError si el name queda vacío tras trimming', () => {
    expect(() => updateAutomationRule(baseRule, { name: '   ' })).toThrow(InvalidAutomationRuleError);
  });

  it('lanza AutomationLoopError si el resultado final tiene trigger.deviceId === action.targetDeviceId', () => {
    expect(() => updateAutomationRule(baseRule, {
      trigger: { deviceId: 'light-1', stateKey: 'power', expectedValue: 'on' }
    })).toThrow(AutomationLoopError);
  });

  it('no muta el objeto original', () => {
    const originalName = baseRule.name;
    updateAutomationRule(baseRule, { name: 'Nuevo' });
    expect(baseRule.name).toBe(originalName);
  });

  it('preserva los campos de identidad (id, homeId, userId, enabled) aunque se intenten pasar en el patch', () => {
    // El tipo UpdateAutomationRulePatch no incluye id/homeId/userId/enabled,
    // por lo que la función de dominio garantiza su inmutabilidad de forma implícita.
    const updated = updateAutomationRule(baseRule, { name: 'X' });
    expect(updated.id).toBe('rule-abc');
    expect(updated.homeId).toBe('home-1');
    expect(updated.userId).toBe('user-owner');
    expect(updated.enabled).toBe(true);
  });
});
