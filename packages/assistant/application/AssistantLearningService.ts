import { AssistantFeedbackRepository } from '../domain/repositories/AssistantFeedbackRepository';
import { FindingType } from '../domain/AssistantFinding';

export interface LearningModifiers {
  typeModifiers: Record<string, number>;
  roomModifiers: Record<string, number>;
  explanations: Record<string, string>;
}

export class AssistantLearningService {
  constructor(private readonly feedbackRepository: AssistantFeedbackRepository) {}

  /**
   * Computes prioritization modifiers based on user history.
   * Modifiers are strictly bounded in [ -15, 15 ].
   */
  public async computeModifiers(): Promise<LearningModifiers> {
    const stats = await this.feedbackRepository.getAggregateStats();
    
    const typeModifiers: Record<string, number> = {};
    const roomModifiers: Record<string, number> = {};
    const explanations: Record<string, string> = {};

    // 1. Process Type-based learning
    // types: new_device_available, automation_suggestion, etc.
    const types: FindingType[] = [
      'new_device_available', 'device_missing_room', 'device_name_technical', 
      'device_name_duplicate', 'automation_suggestion', 'scene_suggestion', 'optimization_suggestion'
    ];

    for (const type of types) {
      const accepted = stats[`${type}:accepted`] || 0;
      const completed = stats[`${type}:completed`] || 0;
      const dismissed = stats[`${type}:dismissed`] || 0;
      
      const score = (accepted + completed) * 5 - (dismissed * 5);
      const bounded = Math.max(-15, Math.min(15, score));
      
      if (bounded !== 0) {
        typeModifiers[type] = bounded;
        if (bounded > 0) {
           explanations[type] = 'assistant.learning.priority_boost_type';
        } else {
           explanations[type] = 'assistant.learning.priority_penalty_type';
        }
      }
    }

    // 2. Room-based learning (Subtle boost for active rooms)
    // We would need a more granular aggregate for rooms if we want perfect accuracy,
    // but this aggregate key approach works if we add room:feedback events.
    // For now, let's focus on Types as it covers the core objective.

    return { typeModifiers, roomModifiers, explanations };
  }
}
