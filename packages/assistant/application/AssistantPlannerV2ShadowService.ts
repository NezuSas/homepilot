import { LlmIntentInterpreter } from './LlmIntentInterpreter';
import { PlannerV2Validator } from './PlannerV2Validator';
import { PlannerV2Resolver } from './PlannerV2Resolver';
import { AssistantConversationResponse } from './AssistantConversationService';
import { TargetReference, AssistantPlanV2 } from './ports/AssistantPlannerV2';

export interface ShadowResolutionResult {
  target: TargetReference;
  resolvedType: string;
  resolvedIds: string[];
}

export type ShadowErrorType = 'llm_failure' | 'validation_failure' | 'resolution_failure' | 'unknown';

/**
 * AssistantPlannerV2ShadowService
 * 
 * Orchestrates the "Shadow Mode" execution for Planner V2.
 * Enhanced for runtime observability, controlled activation, and performance monitoring.
 */
export class AssistantPlannerV2ShadowService {
  private readonly isShadowEnabled: boolean;
  private readonly sampleRate: number;

  constructor(
    private readonly llmInterpreter: LlmIntentInterpreter,
    private readonly validator: PlannerV2Validator,
    private readonly resolver: PlannerV2Resolver
  ) {
    const flag = process.env.ASSISTANT_PLANNER_V2_SHADOW === 'true';
    const isDev = process.env.NODE_ENV !== 'production';
    const force = process.env.ASSISTANT_PLANNER_V2_SHADOW_FORCE === 'true';
    
    this.isShadowEnabled = flag && (isDev || force);
    this.sampleRate = parseFloat(process.env.ASSISTANT_PLANNER_V2_SHADOW_SAMPLE_RATE || '1.0');
  }

  /**
   * Executes the shadow run logic.
   * This is a "fire-and-forget" style call that captures and logs its own errors.
   */
  public async runShadow(
    prompt: string, 
    userId: string, 
    language: string, 
    v1Response: AssistantConversationResponse
  ): Promise<void> {
    if (!this.isShadowEnabled) return;

    // Apply sampling
    if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      return;
    }

    // Use try-catch to ensure total isolation from the main flow
    try {
      const t0 = Date.now();
      let errorInfo: { message: string; type: ShadowErrorType } | null = null;
      let plan: AssistantPlanV2 | null = null;
      let validationError: string | null = null;
      let resolutionResults: ShadowResolutionResult[] = [];

      // 1. Semantic Interpretation (LLM Call)
      try {
        plan = await this.llmInterpreter.interpretV2(prompt, userId);
        if (!plan) {
          errorInfo = { message: 'LLM returned null or empty plan', type: 'llm_failure' };
        }
      } catch (err: unknown) {
        errorInfo = { 
          message: err instanceof Error ? err.message : String(err), 
          type: 'llm_failure' 
        };
      }

      // 2. Validation (only if plan exists)
      if (plan && !errorInfo) {
        validationError = this.validator.validate(plan);
        if (validationError) {
          errorInfo = { message: validationError, type: 'validation_failure' };
        }
      }

      // 3. Resolution (Dry-run) (only if valid)
      if (!errorInfo && plan?.actions) {
        try {
          for (const action of plan.actions) {
            if (resolutionResults.length >= 10) break; // Log Size Protection

            const resolved = await this.resolver.resolve(action.target, userId);
            resolutionResults.push({
              target: action.target,
              resolvedType: resolved.type,
              resolvedIds: resolved.deviceId ? [resolved.deviceId] : 
                           resolved.deviceIds ? resolved.deviceIds.slice(0, 5) : // Limit resolved IDs per target
                           resolved.sceneId ? [resolved.sceneId] : 
                           resolved.roomIds ? resolved.roomIds.slice(0, 5) : []
            });
          }
        } catch (err: unknown) {
          errorInfo = { 
            message: err instanceof Error ? err.message : String(err), 
            type: 'resolution_failure' 
          };
        }
      }

      const latencyMs = Date.now() - t0;

      // Performance Monitoring
      if (latencyMs > 1500) {
        console.warn(`[PLANNER_V2_SHADOW] Slow execution: ${latencyMs}ms for prompt "${prompt}"`);
      }

      // 4. Structured Diagnostic Logging
      // Truncate plan string if too large for safe logging
      const planStr = plan ? JSON.stringify(plan) : 'null';
      const safePlan = planStr.length > 2000 ? { truncated: true, originalLength: planStr.length } : plan;

      console.info(`[PLANNER_V2_SHADOW_V2] ${JSON.stringify({
        version: "v2",
        timestamp: new Date().toISOString(),
        userId,
        prompt,
        language,
        v1: {
          type: v1Response.type,
          message: v1Response.message
        },
        v2: {
          plan: safePlan,
          validation: validationError || 'valid',
          resolution: resolutionResults
        },
        metrics: {
          latency_ms: latencyMs
        },
        error: errorInfo
      })}`);

    } catch (error: unknown) {
      console.warn(`[PLANNER_V2_SHADOW_V2] Unexpected error:`, error instanceof Error ? error.message : String(error));
    }
  }

  public getStatus() {
    return {
      enabled: this.isShadowEnabled,
      sampleRate: this.sampleRate,
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
