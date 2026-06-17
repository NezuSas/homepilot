import type { AssistantConversationResponse } from './AssistantConversationService';

export type QuickResponseKind = 'greeting' | 'wellness' | 'name';

export class AssistantQuickResponseService {
  public static format(kind: QuickResponseKind, language: 'es' | 'en', userName?: string | null): AssistantConversationResponse {
    const suffix = userName ? `, ${userName}` : '';

    if (kind === 'greeting') {
      return {
        type: 'answer',
        message: language === 'en'
          ? `At your service${suffix}. The residence is standing by.`
          : `A la orden${suffix}. La casa está atenta.`
      };
    }

    if (kind === 'wellness') {
      return {
        type: 'answer',
        message: language === 'en'
          ? 'Operating normally. Local control, voice services, and residential systems are standing by.'
          : 'Operando con normalidad. Control local, voz y sistemas residenciales atentos.'
      };
    }

    return {
      type: 'answer',
      message: language === 'en'
        ? 'I am HomePilot, your local residential operator.'
        : 'Soy HomePilot, tu operador residencial local.'
    };
  }
}
