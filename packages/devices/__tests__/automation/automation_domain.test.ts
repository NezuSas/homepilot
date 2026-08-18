import { createAutomationRule } from '../../domain/automation/createAutomationRule';
import { updateAutomationRule } from '../../domain/automation/updateAutomationRule';
import { InvalidAutomationRuleError, AutomationLoopError } from '../../domain/errors';

describe('Automation Domain: createAutomationRule', () => {
  const idGen = { generate: () => 'rule-test-id' };

  const validTrigger = {
    type: 'device_state_changed' as const,
    deviceId: 'sensor-1',
    stateKey: 'contact',
    expectedValue: 'open'
  };

  const validAction = {
    type: 'device_command' as const,
    targetDeviceId: 'light-1',
    command: 'turn_on' as any
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
    expect((rule.trigger as any).deviceId).toBe('sensor-1');
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
    expect(typeof (ruleBool.trigger as any).expectedValue).toBe('boolean');

    const ruleNum = createAutomationRule({
      homeId: 'h1', userId: 'u1', name: 'N',
      trigger: { ...validTrigger, expectedValue: 42 },
      action: validAction
    }, idGen);
    expect(typeof (ruleNum.trigger as any).expectedValue).toBe('number');

    const ruleStr = createAutomationRule({
      homeId: 'h1', userId: 'u1', name: 'N',
      trigger: { ...validTrigger, expectedValue: 'on' },
      action: validAction
    }, idGen);
    expect(typeof (ruleStr.trigger as any).expectedValue).toBe('string');
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
    trigger: Object.freeze({ type: 'device_state_changed' as const, deviceId: 'sensor-1', stateKey: 'contact', expectedValue: 'open' }),
    action: Object.freeze({ type: 'device_command' as const, targetDeviceId: 'light-1', command: 'turn_on' as any })
  });

  it('actualiza el nombre correctamente con trimming', () => {
    const updated = updateAutomationRule(baseRule, { name: '  Renombrada  ' });
    expect(updated.name).toBe('Renombrada');
    // Resto de campos preservados
    expect((updated.trigger as any).deviceId).toBe('sensor-1');
    expect((updated.action as any).targetDeviceId).toBe('light-1');
  });

  it('preserva trigger y action cuando el patch solo incluye name', () => {
    const updated = updateAutomationRule(baseRule, { name: 'Nuevo Nombre' });
    expect(updated.trigger).toEqual(baseRule.trigger);
    expect(updated.action).toEqual(baseRule.action);
  });

  it('preserva name y action cuando el patch solo incluye trigger', () => {
    const newTrigger = { type: 'device_state_changed' as const, deviceId: 'sensor-2', stateKey: 'presence', expectedValue: true };
    const updated = updateAutomationRule(baseRule, { trigger: newTrigger });
    expect(updated.name).toBe('Regla Original');
    expect((updated.trigger as any).deviceId).toBe('sensor-2');
    expect(updated.action).toEqual(baseRule.action);
  });

  it('lanza InvalidAutomationRuleError si el name queda vacío tras trimming', () => {
    expect(() => updateAutomationRule(baseRule, { name: '   ' })).toThrow(InvalidAutomationRuleError);
  });

  it('lanza AutomationLoopError si el resultado final tiene trigger.deviceId === action.targetDeviceId', () => {
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'device_state_changed' as const, deviceId: 'light-1', stateKey: 'power', expectedValue: 'on' }
    })).toThrow(AutomationLoopError);
  });

  it('no muta el objeto original', () => {
    const originalName = baseRule.name;
    updateAutomationRule(baseRule, { name: 'Nuevo' });
    expect(baseRule.name).toBe(originalName);
  });

  it('normalizes updated time triggers and rejects incomplete time configuration', () => {
    const updated = updateAutomationRule(baseRule, {
      trigger: { type: 'time', timeLocal: '08:30', timezone: 'America/Guayaquil', timeUTC: '' }
    });
    expect(updated.trigger).toEqual(expect.objectContaining({ timeLocal: '08:30', timeUTC: expect.any(String) }));
    expect(Object.isFrozen(updated)).toBe(true);
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'time', timeLocal: '', timezone: '', timeUTC: '' }
    })).toThrow('trigger.timeLocal');
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'time', timeLocal: '08:30', timezone: '', timeUTC: '' }
    })).toThrow('trigger.timezone');
  });

  it('validates updated compound and delay actions before replacing the rule', () => {
    const condition = { type: 'device_state_changed' as const, deviceId: 'sensor-2', stateKey: 'state', expectedValue: 'on' };
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'compound', operator: 'NOT', conditions: [condition, { ...condition, deviceId: 'sensor-3' }] }
    })).toThrow('NOT requires exactly 1');
    expect(() => updateAutomationRule(baseRule, {
      action: { type: 'delay', delaySeconds: 0, then: { type: 'device_command', targetDeviceId: 'light-2', command: 'turn_on' } }
    })).toThrow('positive number');
    expect(() => updateAutomationRule(baseRule, {
      action: { type: 'device_command', targetDeviceId: 'light-2', command: 'unsupported' as never }
    })).toThrow('action.command');
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'device_state_changed', deviceId: 'sensor-2', stateKey: 'state', expectedValue: { invalid: true } as never }
    })).toThrow('trigger.expectedValue must be a primitive type');
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
  it('rejects invalid time, compound and delay patches', () => {
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'time', timeLocal: '29:99', timezone: 'America/Guayaquil', timeUTC: '' }
    })).toThrow('format HH:mm');
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'compound', operator: 'AND', conditions: [] }
    })).toThrow('at least one required');
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'compound', operator: 'XOR' as never, conditions: [
        { type: 'device_state_changed', deviceId: 'sensor-2', stateKey: 'state', expectedValue: 'on' }
      ] }
    })).toThrow('must be AND, OR or NOT');
    expect(() => updateAutomationRule(baseRule, {
      trigger: { type: 'compound', operator: 'AND', conditions: [
        { type: 'device_state_changed', deviceId: 'sensor-2', stateKey: 'state', expectedValue: 'on' }
      ] }
    })).toThrow('AND/OR require at least 2');
    expect(() => updateAutomationRule(baseRule, {
      action: { type: 'delay', delaySeconds: 5 } as never
    })).toThrow('action.then');
    expect(() => updateAutomationRule(baseRule, {
      action: { type: 'delay', delaySeconds: 5, then: { type: 'delay' } } as never
    })).toThrow('action.then.type');
  });
});

describe('Automation Domain: remaining creation validations', () => {
  const idGen = { generate: () => 'rule-test-id' };
  const deviceTrigger = { type: 'device_state_changed' as const, deviceId: 'sensor-1', stateKey: 'contact', expectedValue: 'open' };
  const deviceAction = { type: 'device_command' as const, targetDeviceId: 'light-1', command: 'turn_on' as const };
  const payload = { homeId: 'home-1', userId: 'user-1', name: 'Rule', trigger: deviceTrigger, action: deviceAction };

  it('validates required fields and device-state trigger integrity', () => {
    expect(() => createAutomationRule({ ...payload, homeId: ' ' }, idGen)).toThrow('homeId');
    expect(() => createAutomationRule({ ...payload, userId: '' }, idGen)).toThrow('userId');
    expect(() => createAutomationRule({ ...payload, trigger: { ...deviceTrigger, deviceId: '' } }, idGen)).toThrow('trigger.deviceId');
    expect(() => createAutomationRule({ ...payload, trigger: { ...deviceTrigger, stateKey: '' } }, idGen)).toThrow('trigger.stateKey');
    expect(() => createAutomationRule({ ...payload, trigger: { ...deviceTrigger, expectedValue: { invalid: true } as never } }, idGen)).toThrow('trigger.expectedValue must be a primitive type');
  });

  it('normalizes valid time triggers and rejects incomplete or invalid clock values', () => {
    const timePayload = { ...payload, trigger: { type: 'time' as const, timeLocal: '08:30', timeUTC: '', timezone: 'America/Guayaquil' } };
    const rule = createAutomationRule(timePayload, idGen);
    expect(rule.trigger).toEqual(expect.objectContaining({ timeLocal: '08:30', timeUTC: expect.any(String) }));
    expect(() => createAutomationRule({ ...timePayload, trigger: { ...timePayload.trigger, timeLocal: '' } }, idGen)).toThrow('trigger.timeLocal');
    expect(() => createAutomationRule({ ...timePayload, trigger: { ...timePayload.trigger, timezone: '' } }, idGen)).toThrow('trigger.timezone');
    expect(() => createAutomationRule({ ...timePayload, trigger: { ...timePayload.trigger, timeLocal: '25:99' } }, idGen)).toThrow('format HH:mm');
  });

  it('enforces compound trigger cardinality and supports valid AND, OR, and NOT conditions', () => {
    const second = { ...deviceTrigger, deviceId: 'sensor-2' };
    const compoundPayload = { ...payload, trigger: { type: 'compound' as const, operator: 'AND' as const, conditions: [deviceTrigger, second] } };
    expect(createAutomationRule(compoundPayload, idGen).trigger).toEqual(expect.objectContaining({ operator: 'AND' }));
    expect(createAutomationRule({ ...compoundPayload, trigger: { type: 'compound', operator: 'OR', conditions: [deviceTrigger, second] } }, idGen).trigger).toEqual(expect.objectContaining({ operator: 'OR' }));
    expect(createAutomationRule({ ...compoundPayload, trigger: { type: 'compound', operator: 'NOT', conditions: [deviceTrigger] } }, idGen).trigger).toEqual(expect.objectContaining({ operator: 'NOT' }));
    expect(() => createAutomationRule({ ...compoundPayload, trigger: { type: 'compound', operator: 'AND', conditions: [] } }, idGen)).toThrow('at least one required');
    expect(() => createAutomationRule({ ...compoundPayload, trigger: { type: 'compound', operator: 'NOT', conditions: [deviceTrigger, second] } }, idGen)).toThrow('NOT requires exactly 1');
    expect(() => createAutomationRule({ ...compoundPayload, trigger: { type: 'compound', operator: 'AND', conditions: [deviceTrigger] } }, idGen)).toThrow('at least 2 conditions');
  });

  it('validates scene and delay actions and rejects unknown device commands', () => {
    expect(createAutomationRule({ ...payload, action: { type: 'execute_scene', sceneId: 'scene-1' } }, idGen).action).toEqual(expect.objectContaining({ sceneId: 'scene-1' }));
    expect(() => createAutomationRule({ ...payload, action: { type: 'execute_scene', sceneId: '' } }, idGen)).toThrow('action.sceneId');
    expect(createAutomationRule({ ...payload, action: { type: 'delay', delaySeconds: 5, then: deviceAction } }, idGen).action).toEqual(expect.objectContaining({ delaySeconds: 5 }));
    expect(() => createAutomationRule({ ...payload, action: { type: 'delay', delaySeconds: 0, then: deviceAction } }, idGen)).toThrow('positive number');
    expect(() => createAutomationRule({ ...payload, action: { type: 'delay', delaySeconds: 5, then: undefined as never } }, idGen)).toThrow('action.then');
    expect(() => createAutomationRule({ ...payload, action: { type: 'device_command', targetDeviceId: '', command: 'turn_on' } }, idGen)).toThrow('action.targetDeviceId');
    expect(() => createAutomationRule({ ...payload, action: { type: 'device_command', targetDeviceId: 'light-1', command: 'unknown' as never } }, idGen)).toThrow('action.command');
  });
});