import { AssistantFinding, FindingSeverity, FindingType } from '../domain/AssistantFinding';

export class FindingScorer {
  /**
   * Calculates a deterministic score for a finding.
   * Higher score = Higher priority.
   */
  static calculateScore(type: FindingType, severity: FindingSeverity, metadata: Record<string, any> = {}): number {
    let baseScore = 0;

    // 1. Base Type Weights
    switch (type) {
      case 'new_device_available':
        baseScore = 100;
        break;
      case 'device_missing_room':
        baseScore = 80;
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
    // Example: Duplicate names with many instances get a boost
    if (type === 'device_name_duplicate' && metadata.count > 2) {
      score += 15;
    }

    // Example: Suggestions with many linked devices are more valuable
    if (type === 'automation_suggestion' || type === 'scene_suggestion') {
      const entities = (metadata.sensorCount || 0) + (metadata.lightCount || 0) + (metadata.coverCount || 0);
      if (entities > 3) score += 10;
    }

    return Math.round(score);
  }
}
