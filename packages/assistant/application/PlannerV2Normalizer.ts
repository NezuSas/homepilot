import { AssistantPlanV2, PlannerAction } from './ports/AssistantPlannerV2';

export interface NormalizationResult {
  plan: AssistantPlanV2 | null;
  normalized: boolean;
  changes: string[];
}

type MutablePlannerDraft = Omit<Partial<AssistantPlanV2>, 'actions'> & {
  actions?: Array<Partial<PlannerAction>>;
};

export class PlannerV2Normalizer {
  /**
   * Attempts to safely repair missing boilerplate fields in the LLM's output.
   * Does NOT repair missing critical data like target names or invalid commands.
   */
  public normalize(data: unknown): NormalizationResult {
    if (!data || typeof data !== 'object') {
      return { plan: null, normalized: false, changes: [] };
    }

    let plan = data as MutablePlannerDraft;
    const changes: string[] = [];
    let normalized = false;

    // Detect nested { plan: { type: "plan", ... } } and unwrap it
    const asRecord = plan as Record<string, unknown>;
    if (
      asRecord.plan &&
      typeof asRecord.plan === 'object' &&
      !Array.isArray(asRecord.plan) &&
      typeof (asRecord.plan as Record<string, unknown>).type === 'string' &&
      Array.isArray((asRecord.plan as Record<string, unknown>).actions)
    ) {
      plan = asRecord.plan as MutablePlannerDraft;
      changes.push('Unwrapped nested plan object');
      normalized = true;
    }

    const validActionTypes = ['set_state', 'toggle', 'query_status', 'activate_scene'];
    const asRecord2 = plan as Record<string, unknown>;
    
    // Detect if root object is a PlannerAction and wrap it
    if (
      typeof plan.type === 'string' && validActionTypes.includes(plan.type) &&
      asRecord2.target && typeof asRecord2.target === 'object' &&
      typeof asRecord2.command === 'string' &&
      !Array.isArray(plan.actions)
    ) {
      const action = plan as unknown as Partial<PlannerAction>;
      plan = {
        type: 'plan',
        plan_confidence: typeof action.confidence === 'number' ? action.confidence : 0.85,
        actions: [action],
        user_feedback_draft: ''
      };
      changes.push('Wrapped root PlannerAction into AssistantPlanV2');
      normalized = true;
    }

    // We only attempt repair if it looks vaguely like a plan (has an actions array)
    if (Array.isArray(plan.actions)) {
      if (!plan.type) {
        plan.type = 'plan';
        changes.push('Set missing root type to "plan"');
        normalized = true;
      }

      // Action confidences
      let minActionConfidence = 1.0;
      let hasActionConfidences = false;

      for (const action of plan.actions) {
        if (typeof action === 'object' && action !== null) {
          if (typeof action.confidence !== 'number') {
            const fallbackConf = typeof plan.plan_confidence === 'number' ? plan.plan_confidence : 0.85;
            action.confidence = fallbackConf;
            changes.push(`Set missing action.confidence to ${fallbackConf}`);
            normalized = true;
          } else {
            hasActionConfidences = true;
            if (action.confidence < minActionConfidence) {
              minActionConfidence = action.confidence;
            }
          }
        }
      }

      // Plan confidence
      if (typeof plan.plan_confidence !== 'number') {
        const fallbackPlanConf = hasActionConfidences ? minActionConfidence : 0.85;
        plan.plan_confidence = fallbackPlanConf;
        changes.push(`Set missing plan_confidence to ${fallbackPlanConf}`);
        normalized = true;
      }

      // User feedback draft
      if (typeof plan.user_feedback_draft !== 'string') {
        plan.user_feedback_draft = '';
        changes.push('Set missing user_feedback_draft to ""');
        normalized = true;
      }
    }

    return {
      plan: plan as AssistantPlanV2,
      normalized,
      changes
    };
  }
}
