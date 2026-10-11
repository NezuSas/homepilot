import type { AssistantPlanV2 } from '../ports/AssistantPlannerV2';
import type { PlannerPromptMode, ShadowErrorInfo, ShadowResolutionResult } from './shadowTypes';
import type { V1V2Comparison } from './shadowComparison';

export interface ShadowReportInput {
  language: string;
  promptLength: number;
  v1: { type: string; messageLength: number };
  plan: AssistantPlanV2 | null;
  wasNormalized: boolean;
  normalizationChanges: string[];
  validationError: string | null;
  resolutionResults: ShadowResolutionResult[];
  comparison: V1V2Comparison;
  stats: { total_runs: number; v2_better: number; v2_better_ratio: number };
  latencyMs: number;
  promptChars: number;
  homeMapDevicesCount: number;
  model: string;
  timeoutMs: number;
  promptMode: PlannerPromptMode;
  errorInfo: ShadowErrorInfo | null;
}

/** Planes serializados de más de 2000 caracteres se reemplazan por un marcador de truncado. */
export function toSafePlan(plan: AssistantPlanV2 | null): AssistantPlanV2 | null | { truncated: true; originalLength: number } {
  const planStr = plan ? JSON.stringify(plan) : 'null';
  return planStr.length > 2000 ? { truncated: true, originalLength: planStr.length } : plan;
}

/** Construye el registro de diagnóstico estructurado PLANNER_V2_SHADOW_V2. */
export function buildShadowReport(input: ShadowReportInput) {
  const { plan, resolutionResults, v1 } = input;
  return {
    version: 'v2',
    timestamp: new Date().toISOString(),


    language: input.language,
    promptLength: input.promptLength,
    v1: {
      type: v1.type,
      messageLength: v1.messageLength
    },
    v2: {
      plan: toSafePlan(plan),
      normalized: input.wasNormalized,
      normalization_changes: input.normalizationChanges,
      validation: input.validationError || 'valid',
      resolution: resolutionResults
    },
    comparison: {
      v1_type: v1.type,
      v2_type: plan ? plan.type : 'none',
      v2_resolved_type: resolutionResults.length > 0 ? resolutionResults[0].resolvedType : 'none',
      v2_action_count: plan?.actions?.length || 0,
      likely_v2_better_candidate: input.comparison.likelyV2BetterCandidate,
      reason: input.comparison.reason
    },
    stats: input.stats,
    metrics: {
      latency_ms: input.latencyMs,
      prompt_chars: input.promptChars,
      home_map_devices_count: input.homeMapDevicesCount,
      model: input.model,
      timeout_ms: input.timeoutMs,
      ultra_light_prompt_enabled: input.promptMode === 'ultra_light',
      prompt_mode: input.promptMode
    },
    error: input.errorInfo
  };
}
