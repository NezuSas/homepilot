import { FindingSeverity, FindingType } from '../domain/AssistantFinding';
import { LearningModifiers } from './AssistantLearningService';

export interface ScoredFinding {
  score: number;
  explanation?: string;
}

export class FindingScorer {
  /**
   * Calculates a deterministic score for a finding.
   * Higher score = Higher priority.
   */
  static calculateScore(
    type: FindingType, 
    severity: FindingSeverity, 
    metadata: Record<string, any> = {},
    learning?: LearningModifiers
  ): ScoredFinding {
    let baseScore = 0;

    // 1. Base Type Weights
    switch (type) {
      case 'new_device_available':
        baseScore = 100;
        break;
      case 'energy_waste_detected':
        baseScore = 90;
        break;
      case 'habit_pattern_detected':
        baseScore = 85;
        break;
      case 'device_missing_room':
        baseScore = 80;
        break;
      case 'proactive_automation_opportunity':
        baseScore = 75;
        break;
      case 'automation_suggestion':
        baseScore = 70;
        break;
      case 'scene_suggestion':
        baseScore = 60;
        break;
      case 'device_name_duplicate':
        baseScore = 50;
        break;
      case 'device_name_technical':
        baseScore = 40;
        break;
      case 'optimization_opportunity':
      case 'optimization_suggestion':
        baseScore = 30;
        break;
      default:
        baseScore = 20;
    }

    // 2. Severity Multiplier
    const severityMultiplier = {
      high: 1.5,
      medium: 1.0,
      low: 0.7
    };

    let score = baseScore * severityMultiplier[severity];

    // 3. Metadata Boosts
    if (type === 'device_name_duplicate' && metadata.count > 2) {
      score += 15;
    }

    if (type === 'automation_suggestion' || type === 'scene_suggestion') {
      const entities = (metadata.sensorCount || 0) + (metadata.lightCount || 0) + (metadata.coverCount || 0);
      if (entities > 3) score += 10;
    }

    // 4. Learning Modifiers (V4)
    let explanation: string | undefined = undefined;
    if (learning) {
      const typeModifier = learning.typeModifiers[type] || 0;
      if (typeModifier !== 0) {
        score += typeModifier;
        explanation = learning.explanations[type];
      }
    }

    return {
      score: Math.round(score),
      explanation
    };
  }
}
