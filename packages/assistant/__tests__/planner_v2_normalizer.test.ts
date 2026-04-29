import { PlannerV2Normalizer } from '../application/PlannerV2Normalizer';
import { PlannerV2Validator } from '../application/PlannerV2Validator';

describe('PlannerV2Normalizer', () => {
  let normalizer: PlannerV2Normalizer;
  let validator: PlannerV2Validator;

  beforeEach(() => {
    normalizer = new PlannerV2Normalizer();
    validator = new PlannerV2Validator();
  });

  it('should repair missing root type', () => {
    const rawPlan: any = {
      plan_confidence: 0.9,
      actions: [{ type: 'set_state', target: { type: 'device', name: 'luz' }, command: 'turn_on', confidence: 0.9 }],
      user_feedback_draft: 'ok'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.plan?.type).toBe('plan');
    expect(result.changes).toContain('Set missing root type to "plan"');
  });

  it('should repair missing plan_confidence using action confidence', () => {
    const rawPlan: any = {
      type: 'plan',
      actions: [{ type: 'set_state', target: { type: 'device', name: 'luz' }, command: 'turn_on', confidence: 0.92 }],
      user_feedback_draft: 'ok'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.plan?.plan_confidence).toBe(0.92);
    expect(result.changes).toContain('Set missing plan_confidence to 0.92');
  });

  it('should repair missing action.confidence using plan confidence', () => {
    const rawPlan: any = {
      type: 'plan',
      plan_confidence: 0.88,
      actions: [{ type: 'set_state', target: { type: 'device', name: 'luz' }, command: 'turn_on' }],
      user_feedback_draft: 'ok'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.plan?.actions[0].confidence).toBe(0.88);
    expect(result.changes).toContain('Set missing action.confidence to 0.88');
  });

  it('should repair missing user_feedback_draft', () => {
    const rawPlan: any = {
      type: 'plan',
      plan_confidence: 0.9,
      actions: [{ type: 'set_state', target: { type: 'device', name: 'luz' }, command: 'turn_on', confidence: 0.9 }]
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.plan?.user_feedback_draft).toBe('');
    expect(result.changes).toContain('Set missing user_feedback_draft to ""');
  });

  it('should NOT repair missing target.type', () => {
    const rawPlan: any = {
      type: 'plan',
      plan_confidence: 0.9,
      actions: [{ type: 'set_state', target: { name: 'luz' }, command: 'turn_on', confidence: 0.9 }],
      user_feedback_draft: 'ok'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(false); // No repairs made (because the boilerplate was fully present)
    expect(result.plan?.actions[0].target.type).toBeUndefined();
  });

  it('should NOT repair invalid command', () => {
    const rawPlan: any = {
      type: 'plan',
      plan_confidence: 0.9,
      actions: [{ type: 'set_state', target: { type: 'device', name: 'luz' }, command: 'INVALID_CMD', confidence: 0.9 }],
      user_feedback_draft: 'ok'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(false);
    expect(result.plan?.actions[0].command).toBe('INVALID_CMD');
  });
  it('should wrap root query_status action into AssistantPlanV2', () => {
    const rawPlan: any = {
      type: 'query_status',
      target: { type: 'category', name: 'luces' },
      command: 'query',
      confidence: 0.95
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.changes).toContain('Wrapped root PlannerAction into AssistantPlanV2');
    expect(result.plan?.type).toBe('plan');
    expect(result.plan?.plan_confidence).toBe(0.95);
    expect(result.plan?.actions.length).toBe(1);
    expect(result.plan?.actions[0].type).toBe('query_status');
    expect(result.plan?.actions[0].command).toBe('query');
    expect(result.plan?.user_feedback_draft).toBe('');
    
    // validates successfully after wrapping
    expect(validator.validate(result.plan)).toBeNull();
  });

  it('should wrap root set_state action into AssistantPlanV2', () => {
    const rawPlan: any = {
      type: 'set_state',
      target: { type: 'device', name: 'luz' },
      command: 'turn_on',
      params: { brightness: 100 }
    }; // confidence missing, should default to 0.85

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(true);
    expect(result.plan?.type).toBe('plan');
    expect(result.plan?.plan_confidence).toBe(0.85);
    expect(result.plan?.actions[0].confidence).toBe(0.85); // Added by normalizer action iteration
    
    // Validates successfully after normalizer loop fixes the confidence!
    // Wait, the normalizer loop runs AFTER wrapping.
    expect(validator.validate(result.plan)).toBeNull();
  });

  it('should NOT wrap invalid root type', () => {
    const rawPlan: any = {
      type: 'unknown_action',
      target: { type: 'device', name: 'luz' },
      command: 'turn_on'
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(false);
    expect(result.plan?.type).toBe('unknown_action');
  });

  it('should NOT wrap missing target', () => {
    const rawPlan: any = {
      type: 'set_state',
      command: 'turn_on',
      confidence: 0.9
    };

    const result = normalizer.normalize(rawPlan);
    expect(result.normalized).toBe(false);
    expect(result.plan?.type).toBe('set_state');
  });
});
