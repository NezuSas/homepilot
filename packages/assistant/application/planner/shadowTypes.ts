import type { TargetReference } from '../ports/AssistantPlannerV2';

export interface ShadowResolutionResult {
  target: TargetReference;
  resolvedType: string;
  resolvedIds: string[];
  command?: string;
  confidence?: number;
}

export type ShadowErrorType = 'llm_failure' | 'timeout' | 'invalid_json' | 'invalid_json_contract' | 'empty_plan' | 'validation_failure' | 'resolution_failure' | 'build_failure' | 'unknown';

export interface ShadowErrorInfo {
  message: string;
  type: ShadowErrorType;
}

export type PlannerPromptMode = 'full' | 'light' | 'ultra_light';

/** Resultado de una ejecución híbrida aprobada por el gate de seguridad de Planner V2. */
export interface HybridExecutionResult {
  deviceId?: string;
  command: string;
  confidence: number;
  contextSource?: string;
  resolvedType?: string;
  resolvedIds?: string[];
}
