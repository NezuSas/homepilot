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

export type ShadowErrorType = 'llm_failure' | 'timeout' | 'invalid_json' | 'empty_plan' | 'validation_failure' | 'resolution_failure' | 'build_failure' | 'unknown';

/**
 * AssistantPlannerV2ShadowService
 *
 * Orchestrates the "Shadow Mode" execution for Planner V2.
 * Optimized for low-power hardware with light prompts and custom timeouts.
 * All errors are captured internally — shadow failures never affect the V1 response.
 */
export class AssistantPlannerV2ShadowService {
  private readonly isShadowEnabled: boolean;
  private readonly sampleRate: number;
  private readonly lightPromptEnabled: boolean;
  private readonly shadowTimeoutMs: number;
  private readonly shadowModel: string | undefined;
  /** Resolved model for logging: shadow override → OLLAMA_MODEL env → 'phi3' fallback */
  private readonly resolvedModelName: string;

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
    this.lightPromptEnabled = process.env.ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT !== 'false'; // Default: true
    this.shadowTimeoutMs = parseInt(process.env.ASSISTANT_PLANNER_V2_SHADOW_TIMEOUT_MS || '8000', 10);

    // Resolve model name: specific override → OLLAMA_MODEL env → hardcoded fallback
    const modelOverride = process.env.ASSISTANT_PLANNER_V2_SHADOW_MODEL;
    this.shadowModel = modelOverride || undefined;
    this.resolvedModelName = modelOverride || process.env.OLLAMA_MODEL || 'phi3';

    console.info(`[PLANNER_V2_SHADOW_INIT] ${JSON.stringify({
      enabled: this.isShadowEnabled,
      nodeEnv: process.env.NODE_ENV,
      force,
      sampleRate: this.sampleRate,
      lightPrompt: this.lightPromptEnabled,
      timeout: this.shadowTimeoutMs,
      model: this.resolvedModelName
    })}`);
  }

  /**
   * Fire-and-forget shadow execution. Captures all errors internally.
   * Never throws. Never delays or modifies the V1 response.
   */
  public async runShadow(
    prompt: string,
    userId: string,
    language: string,
    v1Response: AssistantConversationResponse
  ): Promise<void> {
    if (!this.isShadowEnabled) return;

    console.info(`[PLANNER_V2_SHADOW_TRIGGER] ${JSON.stringify({ prompt, userId, language })}`);

    // Apply sampling
    if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      return;
    }

    try {
      const t0 = Date.now();
      let errorInfo: { message: string; type: ShadowErrorType } | null = null;
      let plan: AssistantPlanV2 | null = null;
      let validationError: string | null = null;
      let resolutionResults: ShadowResolutionResult[] = [];

      // 1. Semantic Interpretation — interpretV2 never throws, always returns metadata.
      const result = await this.llmInterpreter.interpretV2(prompt, userId, {
        timeoutMs: this.shadowTimeoutMs,
        model: this.shadowModel,
        lightPrompt: this.lightPromptEnabled
      });

      const { metadata } = result;

      // Log prompt built diagnostics immediately after interpretV2 returns metadata
      console.info(`[PLANNER_V2_PROMPT_BUILT] ${JSON.stringify({
        prompt_chars: metadata.promptChars,
        home_map_devices_count: metadata.devicesCount,
        model: this.resolvedModelName,
        timeout_ms: this.shadowTimeoutMs,
        lightPrompt: this.lightPromptEnabled
      })}`);

      if (result.error) {
        const msg = result.error.message;
        let type: ShadowErrorType = 'llm_failure';
        if (msg.includes('timed out')) type = 'timeout';
        else if (msg.includes('JSON') || msg.includes('parse')) type = 'invalid_json';
        else if (msg.includes('empty or invalid object')) type = 'empty_plan';
        else if (msg.includes('build') || msg.includes('homeMap')) type = 'build_failure';
        errorInfo = { message: msg, type };
      } else {
        plan = result.plan;
      }

      // 2. Validation (only if plan exists and no prior error)
      if (plan && !errorInfo) {
        validationError = this.validator.validate(plan);
        if (validationError) {
          errorInfo = { message: validationError, type: 'validation_failure' };
        }
      }

      // 3. Resolution — dry-run only (no execution, no side effects)
      if (!errorInfo && plan?.actions) {
        try {
          for (const action of plan.actions) {
            if (resolutionResults.length >= 10) break;

            const resolved = await this.resolver.resolve(action.target, userId);
            resolutionResults.push({
              target: action.target,
              resolvedType: resolved.type,
              resolvedIds: resolved.deviceId ? [resolved.deviceId] :
                           resolved.deviceIds ? resolved.deviceIds.slice(0, 5) :
                           resolved.sceneId ? [resolved.sceneId] :
                           resolved.roomIds ? resolved.roomIds.slice(0, 5) : []
            });
          }
        } catch (resErr: unknown) {
          errorInfo = {
            message: resErr instanceof Error ? resErr.message : String(resErr),
            type: 'resolution_failure'
          };
        }
      }

      const latencyMs = Date.now() - t0;

      if (latencyMs > 1500) {
        console.warn(`[PLANNER_V2_SHADOW] Slow execution: ${latencyMs}ms for prompt "${prompt}"`);
      }

      // 4. Structured diagnostic log — always emitted, even on failure
      const planStr = plan ? JSON.stringify(plan) : 'null';
      const safePlan = planStr.length > 2000 ? { truncated: true, originalLength: planStr.length } : plan;

      console.info(`[PLANNER_V2_SHADOW_V2] ${JSON.stringify({
        version: 'v2',
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
          latency_ms: latencyMs,
          prompt_chars: metadata.promptChars,
          home_map_devices_count: metadata.devicesCount,
          model: this.resolvedModelName,
          timeout_ms: this.shadowTimeoutMs,
          light_prompt_enabled: this.lightPromptEnabled
        },
        error: errorInfo
      })}`);

    } catch (unexpectedError: unknown) {
      // Outer catch: should never be reached given interpretV2 never throws.
      console.warn(`[PLANNER_V2_SHADOW_V2] Unexpected error: ${unexpectedError instanceof Error ? unexpectedError.message : String(unexpectedError)}`);
    }
  }

  public getStatus() {
    return {
      enabled: this.isShadowEnabled,
      sampleRate: this.sampleRate,
      environment: process.env.NODE_ENV || 'development',
      lightPrompt: this.lightPromptEnabled,
      timeout: this.shadowTimeoutMs,
      model: this.resolvedModelName
    };
  }
}
