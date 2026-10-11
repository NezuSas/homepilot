import { getPromptSkipReason, isPronounPrompt } from '../application/planner/promptSkipPolicy';
import { readPlannerShadowConfig } from '../application/planner/shadowConfig';
import { classifyInterpretError, classifyValidationError, compareV1V2 } from '../application/planner/shadowComparison';
import { buildShadowReport, toSafePlan } from '../application/planner/shadowReport';
import type { AssistantPlanV2 } from '../application/ports/AssistantPlannerV2';

function makePlan(overrides: Partial<AssistantPlanV2> = {}): AssistantPlanV2 {
  return {
    type: 'plan',
    plan_confidence: 0.9,
    actions: [{ type: 'set_state', command: 'turn_on', confidence: 0.9, target: { type: 'device', name: 'lampara' } }],
    ...overrides,
  } as unknown as AssistantPlanV2;
}

describe('promptSkipPolicy', () => {
  it('skips empty, internal selection and language override prompts', () => {
    expect(getPromptSkipReason('   ')).toBe('empty_prompt');
    expect(getPromptSkipReason('Selected: abc')).toBe('internal_selection');
    expect(getPromptSkipReason('selection:abc')).toBe('internal_selection');
    expect(getPromptSkipReason('Habla en Inglés')).toBe('language_override');
    expect(getPromptSkipReason('enciende la luz')).toBeNull();
  });

  it('detects pronoun-only prompts', () => {
    expect(isPronounPrompt(' Apágalo ')).toBe(true);
    expect(isPronounPrompt('them')).toBe(true);
    expect(isPronounPrompt('enciende la luz')).toBe(false);
  });
});

describe('shadowConfig', () => {
  it('enables shadow only outside production unless forced', () => {
    expect(readPlannerShadowConfig({ ASSISTANT_PLANNER_V2_SHADOW: 'true', NODE_ENV: 'production' }).isShadowEnabled).toBe(false);
    expect(readPlannerShadowConfig({ ASSISTANT_PLANNER_V2_SHADOW: 'true', NODE_ENV: 'production', ASSISTANT_PLANNER_V2_SHADOW_FORCE: 'true' }).isShadowEnabled).toBe(true);
    expect(readPlannerShadowConfig({ ASSISTANT_PLANNER_V2_SHADOW: 'true', NODE_ENV: 'development' }).isShadowEnabled).toBe(true);
  });

  it('falls back to safe defaults for sample rate, prompt mode, timeout and model', () => {
    const config = readPlannerShadowConfig({ ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE: '5' });
    expect(config.sampleRate).toBe(0.1);
    expect(config.promptMode).toBe('ultra_light');
    expect(config.executionTimeoutMs).toBe(3500);
    expect(config.resolvedModelName).toBe('phi3');
    expect(config.shadowModel).toBeUndefined();
  });

  it('selects the prompt mode and model from the environment', () => {
    const config = readPlannerShadowConfig({
      ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT: 'false',
      ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT: 'true',
      ASSISTANT_PLANNER_V2_SHADOW_MODEL: 'qwen',
    });
    expect(config.promptMode).toBe('light');
    expect(config.shadowModel).toBe('qwen');
    expect(config.resolvedModelName).toBe('qwen');
    expect(readPlannerShadowConfig({ ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT: 'false' }).promptMode).toBe('full');
  });
});

describe('shadowComparison', () => {
  it('classifies interpreter and validation errors', () => {
    expect(classifyInterpretError('request timed out').type).toBe('timeout');
    expect(classifyInterpretError('bad JSON').type).toBe('invalid_json');
    expect(classifyInterpretError('empty or invalid object').type).toBe('empty_plan');
    expect(classifyInterpretError('failed to build homeMap').type).toBe('build_failure');
    expect(classifyInterpretError('boom').type).toBe('llm_failure');
    expect(classifyValidationError('Invalid target type: x').type).toBe('invalid_json_contract');
    expect(classifyValidationError('Too many actions').type).toBe('validation_failure');
  });

  it('only flags V2 as better when V1 asked for clarification and V2 resolved a single target', () => {
    const plan = makePlan();
    const single = [{ target: plan.actions[0].target, resolvedType: 'single', resolvedIds: ['d1'] }];
    expect(compareV1V2('command', plan, null, null, single)).toEqual({ likelyV2BetterCandidate: false, reason: 'v1_not_clarification' });
    expect(compareV1V2('clarification', plan, null, null, single)).toEqual({ likelyV2BetterCandidate: true, reason: 'v2_single_high_confidence_match' });
    expect(compareV1V2('clarification', null, null, null, []).reason).toBe('v2_invalid_or_error');
    expect(compareV1V2('clarification', plan, null, 'bad', single).reason).toBe('v2_validation_failed');
    expect(compareV1V2('clarification', makePlan({ plan_confidence: 0.5 }), null, null, single).reason).toBe('v2_low_plan_confidence');
    expect(compareV1V2('clarification', plan, null, null, []).reason).toBe('v2_resolution_mismatch');
    expect(compareV1V2('clarification', plan, null, null, [{ ...single[0], resolvedIds: ['a', 'b'] }]).reason).toBe('v2_resolution_not_single');
  });
});

describe('shadowReport', () => {
  it('truncates oversized plans', () => {
    const big = makePlan({ summary: 'x'.repeat(2500) } as Partial<AssistantPlanV2>);
    expect(toSafePlan(big)).toEqual({ truncated: true, originalLength: JSON.stringify(big).length });
    expect(toSafePlan(null)).toBeNull();
  });

  it('builds the structured report with comparison and metrics', () => {
    const plan = makePlan();
    const report = buildShadowReport({
      language: 'es',
      promptLength: 10,
      v1: { type: 'clarification', messageLength: 5 },
      plan,
      wasNormalized: false,
      normalizationChanges: [],
      validationError: null,
      resolutionResults: [],
      comparison: { likelyV2BetterCandidate: false, reason: 'v2_resolution_mismatch' },
      stats: { total_runs: 1, v2_better: 0, v2_better_ratio: 0 },
      latencyMs: 12,
      promptChars: 100,
      homeMapDevicesCount: 3,
      model: 'phi3',
      timeoutMs: 1500,
      promptMode: 'ultra_light',
      errorInfo: null,
    });
    expect(report.version).toBe('v2');
    expect(report.v2.validation).toBe('valid');
    expect(report.comparison).toMatchObject({ v2_type: 'plan', v2_resolved_type: 'none', v2_action_count: 1 });
    expect(report.metrics).toMatchObject({ latency_ms: 12, ultra_light_prompt_enabled: true, prompt_mode: 'ultra_light' });
  });
});
