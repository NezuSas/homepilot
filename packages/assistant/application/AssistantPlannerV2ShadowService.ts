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

/**
 * AssistantPlannerV2ShadowService
 * 
 * Orchestrates the "Shadow Mode" execution for Planner V2.
 * This service runs the new semantic planning loop in parallel with the current flow
 * and logs diagnostics for analysis. It never affects the production response.
 */
export class AssistantPlannerV2ShadowService {
  private readonly isShadowEnabled: boolean;

  constructor(
    private readonly llmInterpreter: LlmIntentInterpreter,
    private readonly validator: PlannerV2Validator,
    private readonly resolver: PlannerV2Resolver
  ) {
    this.isShadowEnabled = process.env.ASSISTANT_PLANNER_V2_SHADOW === 'true';
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

    // Use try-catch to ensure total isolation from the main flow
    try {
      const t0 = Date.now();
      
      // 1. Semantic Interpretation (LLM Call)
      const plan: AssistantPlanV2 | null = await this.llmInterpreter.interpretV2(prompt, userId);
      
      // 2. Validation
      const validationError = this.validator.validate(plan);
      
      // 3. Resolution (Dry-run)
      let resolutionResults: ShadowResolutionResult[] = [];
      if (!validationError && plan?.actions) {
        for (const action of plan.actions) {
          const resolved = await this.resolver.resolve(action.target, userId);
          resolutionResults.push({
            target: action.target,
            resolvedType: resolved.type,
            resolvedIds: resolved.deviceId ? [resolved.deviceId] : 
                         resolved.deviceIds ? resolved.deviceIds : 
                         resolved.sceneId ? [resolved.sceneId] : 
                         resolved.roomIds ? resolved.roomIds : []
          });
        }
      }

      const latencyMs = Date.now() - t0;

      // 4. Structured Diagnostic Logging
      console.info(`[PLANNER_V2_SHADOW] ${JSON.stringify({
        timestamp: new Date().toISOString(),
        userId,
        prompt,
        language,
        v1_type: v1Response.type,
        v1_message: v1Response.message,
        v2_plan: plan,
        v2_validation: validationError || 'valid',
        v2_resolution: resolutionResults,
        latency_ms: latencyMs,
        error: null
      })}`);

    } catch (error: unknown) {
      console.warn(`[PLANNER_V2_SHADOW] Execution error: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
