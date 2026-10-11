import { ASSISTANT_RESPONSE_PREFERENCE_KEY, isAssistantResponsePreference, type AssistantResponsePreference } from '../response/AssistantResponsePreference';
import { ASSISTANT_CONVERSATION_TONE_KEY, ASSISTANT_PREFERRED_ADDRESS_KEY, detectAssistantConversationToneCommand, detectAssistantPreferredAddressCommand, getAssistantConversationToneAcknowledgement, getAssistantPreferredAddressAcknowledgement, isAssistantConversationTone, normalizeAssistantPreferredAddress } from '../response/AssistantConversationProfile';
import { getAssistantResponseText } from '../response/AssistantResponseCatalog';
import { detectAssistantLanguage, detectAssistantLanguageOverride } from '../AssistantLanguagePolicy';
import { normalizeAssistantPrompt } from '../AssistantPromptNormalizer';
import type { AssistantConverseRequest, ConverseStart } from './conversationTypes';
import { ConversationCollaborator } from './ConversationCollaborator';

/** Loads memory, resolves language, response preferences and conversational profile commands. */
export class ConversationPreamble extends ConversationCollaborator {
  public async prepare(request: AssistantConverseRequest, _langHint: string): Promise<ConverseStart> {
    const prompt = request.prompt.trim();
    const userId = request.userId || 'system';
    let userName = request.userName?.trim() || null;
    const normalized = normalizeAssistantPrompt(prompt);

    // V2: Load Contextual Memory & Aliases FIRST
    const [memory, aliases, storedLangPref, storedResponsePreference, storedPreferredAddress, storedConversationTone] = await Promise.all([
      this.deps.memoryService.getShortTermMemory(userId),
      this.deps.memoryService.getAliases(userId),
      this.deps.memoryService.getUserPreference(userId, 'preferred_language'),
      this.deps.memoryService.getUserPreference(userId, ASSISTANT_RESPONSE_PREFERENCE_KEY)
    ,
      this.deps.memoryService.getUserPreference(userId, ASSISTANT_PREFERRED_ADDRESS_KEY),
      this.deps.memoryService.getUserPreference(userId, ASSISTANT_CONVERSATION_TONE_KEY)
    ]);

    // --- LANGUAGE INTELLIGENCE V1 ---
    const langOverride = detectAssistantLanguageOverride(normalized);
    if (langOverride !== null) {
      await this.deps.memoryService.setUserPreference(userId, 'preferred_language', langOverride);
      return {
        response: {
          type: 'answer',
          message: getAssistantResponseText('language.updated', langOverride, {})
        }
      };
    }
    const detectedLang = detectAssistantLanguage(prompt);
    const storedValidLang: 'es' | 'en' = storedLangPref === 'en' ? 'en' : (_langHint === 'en' ? 'en' : 'es');
    const language: 'es' | 'en' = detectedLang ?? storedValidLang;
    const responsePreference: AssistantResponsePreference = isAssistantResponsePreference(storedResponsePreference)
      ? storedResponsePreference
      : 'standard';
    this.deps.memoryService.setUserPreference(userId, 'preferred_language', language).catch(() => {});


    const preferredAddress = normalizeAssistantPreferredAddress(storedPreferredAddress);
    userName = userName ?? preferredAddress;
    const requestedAddress = detectAssistantPreferredAddressCommand(prompt);
    if (requestedAddress) {
      await this.deps.memoryService.setUserPreference(userId, ASSISTANT_PREFERRED_ADDRESS_KEY, requestedAddress);
      return { response: { type: 'answer', message: getAssistantPreferredAddressAcknowledgement(requestedAddress, language) } };
    }

    const requestedTone = detectAssistantConversationToneCommand(prompt);
    if (requestedTone) {
      await this.deps.memoryService.setUserPreference(userId, ASSISTANT_CONVERSATION_TONE_KEY, requestedTone);
      return { response: { type: 'answer', message: getAssistantConversationToneAcknowledgement(requestedTone, language) } };
    }

    const conversationTone = isAssistantConversationTone(storedConversationTone) ? storedConversationTone : 'neutral';

    return {
      context: { request, prompt, userId, userName, normalized, memory, aliases, language, responsePreference, conversationTone }
    };
  }
}
