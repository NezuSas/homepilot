import { LlmIntentInterpreter } from './LlmIntentInterpreter';
import { PlannerV2Validator } from './PlannerV2Validator';
import { PlannerV2Resolver } from './PlannerV2Resolver';
import { PlannerV2Normalizer } from './PlannerV2Normalizer';
import { AssistantConversationResponse } from './AssistantConversationService';
import { TargetReference, AssistantPlanV2 } from './ports/AssistantPlannerV2';
import { AssistantMemoryState } from './ports/AssistantMemoryPort';

export interface ShadowResolutionResult {
  target: TargetReference;
  resolvedType: string;
  resolvedIds: string[];
}

export type ShadowErrorType = 'llm_failure' | 'timeout' | 'invalid_json' | 'invalid_json_contract' | 'empty_plan' | 'validation_failure' | 'resolution_failure' | 'build_failure' | 'unknown';

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
  /** Resolved model for logging: shadow override → OLLAMA_MODEL env → 'phi3' fallback */
  private readonly resolvedModelName: string;

  // In-memory diagnostic counters
  private totalRuns = 0;
  private v2BetterCount = 0;

  private readonly normalizer = new PlannerV2Normalizer();

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
    const ultraLightEnabled = process.env.ASSISTANT_PLANNER_V2_SHADOW_ULTRA_LIGHT_PROMPT !== 'false'; // Default: true
    const lightEnabled = process.env.ASSISTANT_PLANNER_V2_SHADOW_LIGHT_PROMPT === 'true'; // Fallback
    
    this.promptMode = ultraLightEnabled ? 'ultra_light' : (lightEnabled ? 'light' : 'full');
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
      promptMode: this.promptMode,
      ultraLightPrompt: this.promptMode === 'ultra_light',
      timeout: this.shadowTimeoutMs,
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

    const lowerPrompt = prompt.trim().toLowerCase();
    
    let skipReason: string | null = null;
    if (!lowerPrompt) skipReason = 'empty_prompt';
    else if (lowerPrompt.startsWith('selected:')) skipReason = 'internal_selection';
    else if (lowerPrompt.startsWith('selection:')) skipReason = 'internal_selection';
    else if (['habla en español', 'habla en ingles', 'habla en inglés', 'speak in english', 'speak in spanish', 'english', 'spanish', 'español', 'ingles', 'inglés'].includes(lowerPrompt)) skipReason = 'language_override';
    
    if (skipReason) {
      console.info(`[PLANNER_V2_SHADOW_SKIPPED] ${JSON.stringify({ reason: skipReason, prompt })}`);
      return;
    }

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
        promptMode: this.promptMode
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
          const isContractError = validationError.includes('Invalid target type') || validationError.includes('target.type');
          errorInfo = { message: validationError, type: isContractError ? 'invalid_json_contract' : 'validation_failure' as ShadowErrorType };
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

      // 5. V1/V2 Comparison
      let likelyV2BetterCandidate = false;
      let comparisonReason = 'v1_not_clarification';

      if (v1Response.type === 'clarification') {
        if (!plan || errorInfo || validationError) {
          comparisonReason = validationError ? 'v2_validation_failed' : 'v2_invalid_or_error';
        } else if (plan.plan_confidence < 0.8) {
          comparisonReason = 'v2_low_plan_confidence';
        } else if (!plan.actions || plan.actions.length === 0) {
          comparisonReason = 'v2_no_actions';
        } else if (plan.actions.some(a => (a.confidence || 0) < 0.8)) {
          comparisonReason = 'v2_low_action_confidence';
        } else if (resolutionResults.length !== plan.actions.length) {
          comparisonReason = 'v2_resolution_mismatch';
        } else if (resolutionResults.some(r => r.resolvedIds.length !== 1)) {
          comparisonReason = 'v2_resolution_not_single';
        } else {
          likelyV2BetterCandidate = true;
          comparisonReason = 'v2_single_high_confidence_match';
        }
      }

      // 6. Update in-memory stats
      this.totalRuns++;
      if (likelyV2BetterCandidate) {
        this.v2BetterCount++;
      }

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
          normalized: wasNormalized,
          normalization_changes: normalizationChanges,
          validation: validationError || 'valid',
          resolution: resolutionResults
        },
        comparison: {
          v1_type: v1Response.type,
          v2_type: plan ? plan.type : 'none',
          v2_resolved_type: resolutionResults.length > 0 ? resolutionResults[0].resolvedType : 'none',
          v2_action_count: plan?.actions?.length || 0,
          likely_v2_better_candidate: likelyV2BetterCandidate,
          reason: comparisonReason
        },
        stats: this.getMetrics(),
        metrics: {
          latency_ms: latencyMs,
          prompt_chars: metadata.promptChars,
          home_map_devices_count: metadata.devicesCount,
          model: this.resolvedModelName,
          timeout_ms: this.shadowTimeoutMs,
          ultra_light_prompt_enabled: this.promptMode === 'ultra_light',
          prompt_mode: this.promptMode
        },
        error: errorInfo
      })}`);

    } catch (err: unknown) {
      console.warn(`[PLANNER_V2_SHADOW_ERROR] ${err}`);
    }
  }

  /**
   * Attempts to securely execute a prompt using V2 directly.
   * Returns null if any condition fails, allowing V1 fallback.
   */
  public async attemptHybridExecution(
    prompt: string,
    userId: string,
    memory?: AssistantMemoryState | null
  ): Promise<{ deviceId: string; command: string; confidence: number; contextSource?: string } | null> {
    if (process.env.ASSISTANT_PLANNER_V2_EXECUTION !== 'true') return null;

    const skip = (reason: string, extra?: Record<string, unknown>) => {
      console.info(`[PLANNER_V2_EXECUTION_SKIPPED] ${JSON.stringify({ reason, prompt, ...extra })}`);
      return null;
    };

    const lowerPrompt = prompt.trim().toLowerCase();
    let skipReason: string | null = null;
    if (!lowerPrompt) skipReason = 'empty_prompt';
    else if (lowerPrompt.startsWith('selected:')) skipReason = 'internal_selection';
    else if (lowerPrompt.startsWith('selection:')) skipReason = 'internal_selection';
    else if (['habla en español', 'habla en ingles', 'habla en inglés', 'speak in english', 'speak in spanish', 'english', 'spanish', 'español', 'ingles', 'inglés'].includes(lowerPrompt)) skipReason = 'language_override';

    if (skipReason) return skip(skipReason);

    try {
      const result = await this.llmInterpreter.interpretV2(prompt, userId, { promptMode: this.promptMode });
      if (result.error) return skip('llm_error');
      if (!result.plan) return skip('empty_plan');

      // Always normalize before validating — same pipeline as shadow
      const normResult = this.normalizer.normalize(result.plan);
      const plan = normResult.plan;
      if (!plan) return skip('normalization_failed');

      const validationError = this.validator.validate(plan);
      if (validationError) return skip('validation_failed', {
        validation_error: validationError,
        normalized: normResult.normalized,
        normalization_changes: normResult.changes
      });

      // 1. STRICT GATE CHECKS
      if (plan.type !== 'plan') return skip('invalid_root_type');
      if (!plan.actions || plan.actions.length !== 1) return skip('multiple_actions');

      const action = plan.actions[0];
      if (action.type !== 'set_state') return skip('invalid_action_type');

      const allowedCommands = ['turn_on', 'turn_off', 'toggle'];
      if (!action.command || !allowedCommands.includes(action.command)) return skip('invalid_command');

      if (typeof action.confidence !== 'number' || action.confidence < 0.85) return skip('low_confidence');

      // 2. RESOLUTION
      const isPronounPrompt = /^(enci[eé]ndel[ao]s?|pr[eé]ndel[ao]s?|ap[aá]gal[ao]s?|es[ao]s?|la misma|el mismo|los mismos|las mismas|it|them)$/.test(lowerPrompt);
      const isContextReference = action.target.type === 'context_reference';

      let resolved: { type: string; deviceId?: string; contextSource?: string };

      if (isPronounPrompt) {
        if (!memory || memory.lastQueryType !== 'command' || !memory.entities || memory.entities.length !== 1) {
          return skip('unsafe_context_resolution', {
            memory_lastQueryType: memory?.lastQueryType,
            memory_entities_count: memory?.entities?.length
          });
        }
        
        resolved = {
          type: 'single',
          deviceId: memory.entities[0].id,
          contextSource: 'short_term_memory'
        };
        
        console.info(`[PLANNER_V2_CONTEXT_RESOLVED] ${JSON.stringify({
          context_source: 'short_term_memory',
          resolvedIds: [resolved.deviceId],
          prompt
        })}`);
      } else {
        const res = await this.resolver.resolve(action.target, userId);
        resolved = { type: res.type, deviceId: res.deviceId, contextSource: res.contextSource };
        
        if (isContextReference && resolved.contextSource !== 'short_term_memory') {
          return skip('unsafe_context_resolution');
        }
      }

      if (resolved.type !== 'single' || !resolved.deviceId) return skip('non_single_resolution');

      const finalContextSource = resolved.contextSource || 'semantic_match';

      // 3. SUCCESSFUL GATE PASS
      console.info(`[PLANNER_V2_EXECUTION_APPROVED] ${JSON.stringify({
        prompt,
        deviceId: resolved.deviceId,
        command: action.command,
        confidence: action.confidence,
        context_source: finalContextSource,
        normalized: normResult.normalized,
        normalization_changes: normResult.changes
      })}`);

      return {
        deviceId: resolved.deviceId,
        command: action.command,
        confidence: action.confidence,
        contextSource: finalContextSource
      };

    } catch (e) {
      return skip('unexpected_error');
    }
  }

  public getStatus() {
    return {
      enabled: this.isShadowEnabled,
      sampleRate: this.sampleRate,
      environment: process.env.NODE_ENV || 'development',
      promptMode: this.promptMode,
      timeout: this.shadowTimeoutMs,
      model: this.resolvedModelName
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
