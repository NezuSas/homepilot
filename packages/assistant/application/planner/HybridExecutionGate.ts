import type { LlmIntentInterpreter } from '../LlmIntentInterpreter';
import type { PlannerV2Validator } from '../PlannerV2Validator';
import type { PlannerV2Resolver } from '../PlannerV2Resolver';
import type { PlannerV2Normalizer } from '../PlannerV2Normalizer';
import type { LlmCircuitBreaker } from '../LlmCircuitBreaker';
import type { PlannerAction } from '../ports/AssistantPlannerV2';
import type { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import { getPromptSkipReason, isPronounPrompt } from './promptSkipPolicy';
import { classifyInterpretError } from './shadowComparison';
import type { HybridExecutionResult, PlannerPromptMode } from './shadowTypes';

export interface HybridExecutionConfig {
  promptMode: PlannerPromptMode;
  executionTimeoutMs: number;
  shadowModel: string | undefined;
}

type SkipFn = (reason: string, extra?: Record<string, unknown>) => null;

/**
 * Gate estricto de ejecución híbrida: usa Planner V2 solo cuando todas las
 * comprobaciones de seguridad pasan; ante cualquier duda devuelve null para
 * que el flujo V1 determinista decida.
 */
export class PlannerV2HybridExecutionGate {
  constructor(
    private readonly llmInterpreter: LlmIntentInterpreter,
    private readonly validator: PlannerV2Validator,
    private readonly resolver: PlannerV2Resolver,
    private readonly normalizer: PlannerV2Normalizer,
    private readonly circuitBreaker: LlmCircuitBreaker,
    private readonly config: HybridExecutionConfig
  ) {}

  /**
   * Attempts to securely execute a prompt using V2 directly.
   * Returns null if any condition fails, allowing V1 fallback.
   */
  public async attempt(
    prompt: string,
    userId: string,
    memory?: AssistantMemoryState | null
  ): Promise<HybridExecutionResult | null> {
    if (process.env.ASSISTANT_PLANNER_V2_EXECUTION !== 'true') return null;

    const skip: SkipFn = (reason, extra) => {
      console.info(`[PLANNER_V2_EXECUTION_SKIPPED] ${JSON.stringify({ reason, promptLength: prompt.length, ...extra })}`);
      return null;
    };

    const skipReason = getPromptSkipReason(prompt);
    if (skipReason) return skip(skipReason);

    // Ollama down/struggling: skip the LLM call entirely instead of paying the
    // full execution timeout on every single turn during an outage.
    if (this.circuitBreaker.isOpen()) return skip('circuit_open');

    try {
      const result = await this.llmInterpreter.interpretV2(prompt, userId, {
        promptMode: this.config.promptMode,
        timeoutMs: this.config.executionTimeoutMs,
        model: this.config.shadowModel,
        // A pretty-printed plan runs past the 96 tokens that suit shadow sampling; cutting it
        // mid-object leaves invalid JSON and the whole turn falls back.
        numPredict: 320
      });
      if (result.error) {
        this.circuitBreaker.recordFailure();
        // Only the failure class and a short head of the message: enough to tell a timeout from a
        // malformed answer without ever logging the prompt.
        return skip('llm_error', { error_type: classifyInterpretError(result.error.message).type, error_head: result.error.message.slice(0, 60) });
      }
      if (!result.plan) {
        this.circuitBreaker.recordFailure();
        return skip('empty_plan');
      }
      this.circuitBreaker.recordSuccess();

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
      if (!plan.actions || plan.actions.length === 0) return skip('empty_actions');

      const allowedCommands = ['turn_on', 'turn_off', 'toggle'];

      if (plan.actions.length > 1) {
        // Multi-action plan (e.g. "prende la sala y la cocina"): only supported when
        // every action shares the same command and resolves to exactly one distinct
        // device each. This lets the model handle compound phrasing the deterministic
        // multi-command parser's fixed connector list (" y ", " tambien ", ...) would
        // otherwise have to hardcode — while never auto-executing on more than one
        // device: it reuses the exact same "guarded multi-target" return shape the
        // single-action path already uses for category/multi-device resolutions,
        // so the caller still requires an explicit confirmation ticket either way.
        return this.attemptMultiActionResolution(plan.actions, allowedCommands, userId, skip);
      }

      const action = plan.actions[0];
      if (action.type !== 'set_state') return skip('invalid_action_type');

      if (!action.command || !allowedCommands.includes(action.command)) return skip('invalid_command');

      if (typeof action.confidence !== 'number' || action.confidence < 0.85) return skip('low_confidence');

      // 2. RESOLUTION
      const isContextReference = action.target.type === 'context_reference';

      let resolved: { type: string; deviceId?: string; deviceIds?: string[]; contextSource?: string };

      if (isPronounPrompt(prompt)) {
        if (!memory || memory.lastQueryType !== 'command' || !memory.entities || memory.entities.length === 0) {
          return skip('unsafe_context_resolution', {
            memory_lastQueryType: memory?.lastQueryType,
            memory_entities_count: memory?.entities?.length
          });
        }

        resolved = {
          type: memory.entities.length > 1 ? 'multiple' : 'single',
          deviceId: memory.entities.length === 1 ? memory.entities[0].id : undefined,
          deviceIds: memory.entities.length > 1 ? memory.entities.map(e => e.id) : undefined,
          contextSource: 'short_term_memory'
        };

        console.info(`[PLANNER_V2_CONTEXT_RESOLVED] ${JSON.stringify({
          context_source: 'short_term_memory',
          resolvedIds: [resolved.deviceId]
        })}`);
      } else {
        const res = await this.resolver.resolve(action.target, userId);
        resolved = {
          type: res.type,
          deviceId: res.deviceId,
          deviceIds: res.deviceIds,
          contextSource: res.contextSource
        };

        if (isContextReference && resolved.contextSource !== 'short_term_memory') {
          return skip('unsafe_context_resolution');
        }
      }

      // 3. SUCCESSFUL GATE PASS (or Guarded Multi-Target)
      if (resolved.type === 'category' || (resolved.deviceIds && resolved.deviceIds.length > 1)) {
        return {
          command: action.command,
          confidence: action.confidence,
          resolvedType: resolved.type,
          resolvedIds: resolved.deviceIds || []
        };
      }

      if (resolved.type !== 'single' || !resolved.deviceId) return skip('non_single_resolution');

      const finalContextSource = resolved.contextSource || 'semantic_match';

      // 3. SUCCESSFUL GATE PASS
      console.info(`[PLANNER_V2_EXECUTION_APPROVED] ${JSON.stringify({

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

  /**
   * Resolves a multi-action plan into the same "guarded multi-target" shape
   * `attempt` already returns for a single action resolving to a
   * category/multiple devices — so the caller's existing confirmation-ticket
   * flow handles it unchanged. Fails closed (skips the whole plan) rather than
   * partially executing: mixed commands, non-single resolutions, pronoun/context
   * references, or an over-long plan all abort the entire multi-action attempt.
   */
  private async attemptMultiActionResolution(
    actions: PlannerAction[],
    allowedCommands: string[],
    userId: string,
    skip: SkipFn
  ): Promise<HybridExecutionResult | null> {
    if (actions.length > 8) return skip('too_many_actions');

    const sharedCommand = actions[0].command;
    for (const action of actions) {
      if (action.type !== 'set_state') return skip('invalid_action_type');
      if (!action.command || !allowedCommands.includes(action.command)) return skip('invalid_command');
      if (action.command !== sharedCommand) return skip('mixed_commands_unsupported');
      if (typeof action.confidence !== 'number' || action.confidence < 0.85) return skip('low_confidence');
      // Pronoun/context resolution is inherently single-referent; mixing it into a
      // multi-action plan is an ambiguous case left to the deterministic fallback.
      if (action.target.type === 'context_reference') return skip('unsafe_context_resolution');
    }

    const deviceIds: string[] = [];
    let minConfidence = 1;
    for (const action of actions) {
      const resolved = await this.resolver.resolve(action.target, userId);
      if (resolved.type !== 'single' || !resolved.deviceId) return skip('non_single_resolution');
      deviceIds.push(resolved.deviceId);
      minConfidence = Math.min(minConfidence, action.confidence);
    }

    console.info(`[PLANNER_V2_MULTI_ACTION_RESOLVED] ${JSON.stringify({ count: deviceIds.length, command: sharedCommand })}`);

    return {
      command: sharedCommand as string,
      confidence: minConfidence,
      resolvedType: 'multiple',
      resolvedIds: deviceIds
    };
  }
}
