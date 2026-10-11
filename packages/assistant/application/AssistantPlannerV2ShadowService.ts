import { LlmIntentInterpreter } from './LlmIntentInterpreter';
import { PlannerV2Validator } from './PlannerV2Validator';
import { PlannerV2Resolver } from './PlannerV2Resolver';
import { PlannerV2Normalizer } from './PlannerV2Normalizer';
import { AssistantConversationResponse } from './AssistantConversationService';
import { AssistantPlanV2 } from './ports/AssistantPlannerV2';
import { AssistantMemoryState } from './ports/AssistantMemoryPort';
import { LlmCircuitBreaker } from './LlmCircuitBreaker';
import { readPlannerShadowConfig, SHADOW_MAX_TOKENS } from './planner/shadowConfig';
import { getPromptSkipReason } from './planner/promptSkipPolicy';
import { classifyInterpretError, classifyValidationError, compareV1V2 } from './planner/shadowComparison';
import { buildShadowReport } from './planner/shadowReport';
import { PlannerV2HybridExecutionGate } from './planner/HybridExecutionGate';
import type { HybridExecutionResult, ShadowErrorInfo, ShadowResolutionResult } from './planner/shadowTypes';

export type { ShadowResolutionResult, ShadowErrorType } from './planner/shadowTypes';

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
  private readonly promptMode: 'full' | 'light' | 'ultra_light';
  private readonly shadowTimeoutMs: number;
  private readonly shadowModel: string | undefined;
  private readonly executionTimeoutMs: number;
  /** Resolved model for logging: shadow override → OLLAMA_MODEL env → 'phi3' fallback */
  private readonly resolvedModelName: string;
  private shadowInFlight = false;

  // In-memory diagnostic counters
  private totalRuns = 0;
  private v2BetterCount = 0;

  private readonly normalizer = new PlannerV2Normalizer();
  /** Only guards the live execution path — shadow mode is diagnostic-only and never blocks the user. */
  private readonly circuitBreaker = new LlmCircuitBreaker();
  private readonly hybridGate: PlannerV2HybridExecutionGate;

  constructor(
    private readonly llmInterpreter: LlmIntentInterpreter,
    private readonly validator: PlannerV2Validator,
    private readonly resolver: PlannerV2Resolver
  ) {
    const config = readPlannerShadowConfig();

    this.isShadowEnabled = config.isShadowEnabled;
    this.sampleRate = config.sampleRate;
    this.promptMode = config.promptMode;
    this.shadowTimeoutMs = config.shadowTimeoutMs;
    this.executionTimeoutMs = config.executionTimeoutMs;
    this.shadowModel = config.shadowModel;
    this.resolvedModelName = config.resolvedModelName;

    this.hybridGate = new PlannerV2HybridExecutionGate(
      llmInterpreter,
      validator,
      resolver,
      this.normalizer,
      this.circuitBreaker,
      { promptMode: this.promptMode, executionTimeoutMs: this.executionTimeoutMs, shadowModel: this.shadowModel }
    );

    console.info(`[PLANNER_V2_SHADOW_INIT] ${JSON.stringify({
      enabled: this.isShadowEnabled,
      nodeEnv: process.env.NODE_ENV,
      force: config.force,
      sampleRate: this.sampleRate,
      promptMode: this.promptMode,
      ultraLightPrompt: this.promptMode === 'ultra_light',
      timeout: this.shadowTimeoutMs,
      maxTokens: SHADOW_MAX_TOKENS,
      model: this.resolvedModelName
    })}`);

    const execEnabled = process.env.ASSISTANT_PLANNER_V2_EXECUTION === 'true';
    console.info(`[PLANNER_V2_EXECUTION_INIT] ${JSON.stringify({
      enabled: execEnabled,
      threshold: 0.85,
      allowedActionTypes: ['set_state']
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

    if (this.shadowInFlight) {
      console.info(`[PLANNER_V2_SHADOW_SKIPPED] ${JSON.stringify({ reason: 'in_flight', promptLength: prompt.length })}`);
      return;
    }

    const skipReason = getPromptSkipReason(prompt);

    if (skipReason) {
      console.info(`[PLANNER_V2_SHADOW_SKIPPED] ${JSON.stringify({ reason: skipReason, promptLength: prompt.length })}`);
      return;
    }

    console.info(`[PLANNER_V2_SHADOW_TRIGGER] ${JSON.stringify({ promptLength: prompt.length, language })}`);

    // Apply sampling
    if (this.sampleRate < 1.0 && Math.random() > this.sampleRate) {
      return;
    }

    this.shadowInFlight = true;
    try {
      const t0 = Date.now();
      let errorInfo: ShadowErrorInfo | null = null;
      let plan: AssistantPlanV2 | null = null;
      let validationError: string | null = null;
      let resolutionResults: ShadowResolutionResult[] = [];

      // 1. Semantic Interpretation — interpretV2 never throws, always returns metadata.
      const result = await this.llmInterpreter.interpretV2(prompt, userId, {
        timeoutMs: this.shadowTimeoutMs,
        model: this.shadowModel,
        promptMode: this.promptMode,
        numPredict: SHADOW_MAX_TOKENS
      });

      const { metadata } = result;

      // Log prompt built diagnostics immediately after interpretV2 returns metadata
      console.info(`[PLANNER_V2_PROMPT_BUILT] ${JSON.stringify({
        prompt_chars: metadata.promptChars,
        home_map_devices_count: metadata.devicesCount,
        model: this.resolvedModelName,
        timeout_ms: this.shadowTimeoutMs,
        promptMode: this.promptMode
      })}`);

      if (result.error) {
        errorInfo = classifyInterpretError(result.error.message);
      } else {
        plan = result.plan;
      }

      // 1.5. Normalization
      let wasNormalized = false;
      let normalizationChanges: string[] = [];
      if (plan && !errorInfo) {
        const normResult = this.normalizer.normalize(plan);
        if (normResult.plan) {
          plan = normResult.plan;
          wasNormalized = normResult.normalized;
          normalizationChanges = normResult.changes;
        }
      }

      // 2. Validation (only if plan exists and no prior error)
      if (plan && !errorInfo) {
        validationError = this.validator.validate(plan);
        if (validationError) {
          errorInfo = classifyValidationError(validationError);
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
        console.warn(`[PLANNER_V2_SHADOW] Slow execution: ${latencyMs}ms`);
      }

      // 4. V1/V2 Comparison
      const comparison = compareV1V2(v1Response.type, plan, errorInfo, validationError, resolutionResults);

      // 5. Update in-memory stats
      this.totalRuns++;
      if (comparison.likelyV2BetterCandidate) {
        this.v2BetterCount++;
      }

      // 6. Structured diagnostic log — always emitted, even on failure
      console.info(`[PLANNER_V2_SHADOW_V2] ${JSON.stringify(buildShadowReport({
        language,
        promptLength: prompt.length,
        v1: { type: v1Response.type, messageLength: v1Response.message.length },
        plan,
        wasNormalized,
        normalizationChanges,
        validationError,
        resolutionResults,
        comparison,
        stats: this.getMetrics(),
        latencyMs,
        promptChars: metadata.promptChars,
        homeMapDevicesCount: metadata.devicesCount,
        model: this.resolvedModelName,
        timeoutMs: this.shadowTimeoutMs,
        promptMode: this.promptMode,
        errorInfo
      }))}`);

    } catch (err: unknown) {
      console.warn(`[PLANNER_V2_SHADOW_ERROR] ${err}`);
    } finally {
      this.shadowInFlight = false;
    }
  }

  /**
   * Attempts to securely execute a prompt using V2 directly.
   * Returns null if any condition fails, allowing V1 fallback.
   */
  public attemptHybridExecution(
    prompt: string,
    userId: string,
    memory?: AssistantMemoryState | null
  ): Promise<HybridExecutionResult | null> {
    return this.hybridGate.attempt(prompt, userId, memory);
  }

  public getStatus() {
    return {
      enabled: this.isShadowEnabled,
      sampleRate: this.sampleRate,
      executionTimeout: this.executionTimeoutMs,
      environment: process.env.NODE_ENV || 'development',
      promptMode: this.promptMode,
      timeout: this.shadowTimeoutMs,
      maxTokens: SHADOW_MAX_TOKENS,
      model: this.resolvedModelName,
      circuitBreaker: this.circuitBreaker.getState()
    };
  }

  public getMetrics() {
    return {
      total_runs: this.totalRuns,
      v2_better: this.v2BetterCount,
      v2_better_ratio: this.totalRuns > 0 ? parseFloat((this.v2BetterCount / this.totalRuns).toFixed(2)) : 0
    };
  }
}
