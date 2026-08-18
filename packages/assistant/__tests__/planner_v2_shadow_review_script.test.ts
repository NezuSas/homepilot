import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const reviewScript = join(process.cwd(), 'scripts', 'review-planner-v2-shadow.mjs');

function createShadowRecord(index: number, options: { errorType?: string; candidate?: boolean; sensitivePrompt?: string } = {}) {
  return {
    v2: {
      plan: { type: 'plan', actions: [{ type: 'set_state' }] },
      validation: 'valid',
      resolution: options.errorType ? [] : [{ resolvedType: 'device', resolvedIds: [`device-${index}`] }],
    },
    comparison: {
      v2_action_count: 1,
      likely_v2_better_candidate: options.candidate === true,
    },
    metrics: {
      latency_ms: 450 + (index % 50),
      timeout_ms: 1000,
    },
    error: options.errorType ? { type: options.errorType } : null,
    ...(options.sensitivePrompt ? { prompt: options.sensitivePrompt } : {}),
  };
}

function runReview(records: unknown[], strict = false) {
  return spawnSync(process.execPath, [reviewScript, ...(strict ? ['--strict'] : [])], {
    input: records.map((record) => `[PLANNER_V2_SHADOW_V2] ${JSON.stringify(record)}`).join('\n'),
    encoding: 'utf8',
  });
}

describe('Feature: Planner V2 shadow rollout review', () => {
  it('Scenario: Given 200 safe structured shadow records When the operator reviews them Then it reports only aggregate passing metrics', () => {
    const records = Array.from({ length: 200 }, (_, index) => createShadowRecord(index, {
      candidate: index === 0,
      sensitivePrompt: index === 0 ? 'never expose this prompt' : undefined,
    }));

    const result = runReview(records, true);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).not.toContain('never expose this prompt');
    expect(JSON.parse(result.stdout)).toEqual(expect.objectContaining({
      records: expect.objectContaining({
        sampled: 200,
        validPlans: 200,
        validPlansResolved: 200,
        v2BetterCandidates: 1,
      }),
      metrics: expect.objectContaining({
        validPlanResolutionRate: 1,
        p95LatencyMs: 497,
        configuredTimeoutProfilesMs: [1000],
      }),
      automatedPromotionChecks: expect.objectContaining({
        minimumSamples: expect.objectContaining({ passed: true }),
        validPlanResolutionRate: expect.objectContaining({ passed: true }),
        p95LatencyWithinConfiguredTimeout: expect.objectContaining({ passed: true }),
      }),
    }));
  });

  it('Scenario: Given inadequate shadow quality When strict review runs Then it fails without claiming promotion approval', () => {
    const records = Array.from({ length: 200 }, (_, index) => createShadowRecord(index, {
      errorType: index < 11 ? 'resolution_failure' : undefined,
    }));

    const result = runReview(records, true);
    const summary = JSON.parse(result.stdout);

    expect(result.status).toBe(1);
    expect(summary.metrics.validPlanResolutionRate).toBe(0.945);
    expect(summary.automatedPromotionChecks.validPlanResolutionRate.passed).toBe(false);
    expect(summary.liveExecutionDefault).toContain('must remain false');
  });
});