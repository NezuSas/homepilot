import type { AssistantConversationResponse } from './AssistantConversationService';
import { getAssistantResponseText } from './response/AssistantResponseCatalog';

export type QuickResponseKind = 'greeting' | 'wellness' | 'name';

export class AssistantQuickResponseService {
  public static format(kind: QuickResponseKind, language: 'es' | 'en', userName?: string | null): AssistantConversationResponse {
    if (kind === 'greeting') {
      return {
        type: 'answer',
        message: getAssistantResponseText('quick.greeting', language, { userName })
      };
    }

    if (kind === 'wellness') {
      return {
        type: 'answer',
        message: getAssistantResponseText('quick.wellness', language, {})
      };
    }

    return {
      type: 'answer',
      message: getAssistantResponseText('quick.name', language, {})
    };
  }
}