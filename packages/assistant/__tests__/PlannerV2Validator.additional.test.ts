import { PlannerV2Validator } from '../application/PlannerV2Validator';

const validPlan = () => ({
  type: 'plan',
  plan_confidence: 0.8,
  actions: [{
    type: 'set_state',
    target: { type: 'device', name: 'Luz sala' },
    command: 'turn_on',
    confidence: 0.8,
  }],
  user_feedback_draft: 'Done',
});

describe('PlannerV2Validator additional structural coverage', () => {
  const validator = new PlannerV2Validator();

  it.each([
    [null, 'Plan is null or not an object'],
    [{}, 'Invalid plan type: undefined'],
    [{ type: 'plan', plan_confidence: 0.5, actions: {}, user_feedback_draft: '' }, 'actions must be an array'],
    [{ type: 'plan', plan_confidence: 0.5, actions: [], user_feedback_draft: 1 }, 'user_feedback_draft must be a string'],
  ])('rejects malformed plan structure %#', (plan, expected) => {
    expect(validator.validate(plan)).toBe(expected);
  });

  it.each([
    [{ type: 'unknown', target: { type: 'device', name: 'Luz' }, command: 'turn_on', confidence: 0.5 }, 'Invalid action type: unknown'],
    [{ type: 'set_state', target: { type: 'unknown', name: 'Luz' }, command: 'turn_on', confidence: 0.5 }, 'Invalid target type: unknown'],
    [{ type: 'set_state', target: { type: 'device', name: '  ' }, command: 'turn_on', confidence: 0.5 }, 'Target name must be a non-empty string'],
    [{ type: 'set_state', target: { type: 'device', name: 'Luz' }, command: 'turn_on', confidence: -1 }, 'Action confidence must be a number between 0 and 1'],
  ])('rejects invalid action attributes %#', (action, expected) => {
    expect(validator.validate({ ...validPlan(), actions: [action] })).toBe(expected);
  });

  it.each([
    [{ power: 'maybe' }, 'Invalid power value: maybe'],
    [{ brightness: 12.5 }, 'Brightness must be an integer between 0 and 100'],
    [{ position: 101 }, 'Position must be an integer between 0 and 100'],
    [{ colorTemperature: 'blue' }, 'Invalid colorTemperature: blue'],
  ])('rejects invalid parameter values %#', (params, expected) => {
    expect(validator.validate({ ...validPlan(), actions: [{ ...validPlan().actions[0], params }] })).toBe(expected);
  });

  it('accepts each supported target, command and optional parameter boundary', () => {
    const plan = validPlan();
    plan.actions = ['turn_off', 'toggle', 'open', 'close', 'stop', 'set_position', 'set_brightness', 'query'].map((command, index) => ({
      type: index === 7 ? 'query_status' : 'set_state',
      target: { type: ['device', 'room', 'zone', 'category', 'scene', 'alias', 'context_reference'][index % 7], name: `Target ${index}` },
      command,
      confidence: 0,
      params: index === 5 ? { position: 100 } : index === 6 ? { brightness: 0, power: 'off', colorTemperature: 'cool' } : undefined,
    }));

    expect(validator.validate(plan)).toBeNull();
  });
});