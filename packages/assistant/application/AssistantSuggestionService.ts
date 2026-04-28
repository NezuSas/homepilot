import { AssistantLearningService } from './AssistantLearningService';

export type SuggestionType = 
  | 'scene_suggestion'
  | 'automation_suggestion'
  | 'alias_suggestion'
  | 'room_cleanup_suggestion';

export interface AssistantSuggestion {
  type: SuggestionType;
  message: string;
  metadata: Record<string, unknown>;
}

export class AssistantSuggestionService {
  constructor(private readonly learningService: AssistantLearningService) {}

  public async getSuggestion(userId: string, language: string): Promise<AssistantSuggestion | null> {
    // 1. Check for scene patterns (multiple devices used together in the same room)
    // 2. Check for frequent corrections (alias suggestion)
    
    const corrections = await this.learningService.getRecentCorrections(userId, 5);
    if (corrections.length >= 2) {
      const lastCorrection = corrections[0];
      if (lastCorrection.correction && lastCorrection.prompt) {
        return {
          type: 'alias_suggestion',
          message: language === 'en' 
            ? `I've noticed you frequently correct "${lastCorrection.prompt}" to "${lastCorrection.correction}". Would you like to create an alias?`
            : `He notado que sueles corregir "${lastCorrection.prompt}" por "${lastCorrection.correction}". ¿Quieres crear un alias?`,
          metadata: { alias: lastCorrection.prompt, target: lastCorrection.correction }
        };
      }
    }

    // Default: no suggestion
    return null;
  }
}
