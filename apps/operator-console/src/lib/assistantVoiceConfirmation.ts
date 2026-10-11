import type { AssistantConversationResponse } from '../types/assistantConversation';

/** A clarification that only offers confirm/cancel is answered by voice. */
export function requiresVoiceConfirmation(response: AssistantConversationResponse): boolean {
  if (response.type !== 'clarification') return false;

  const optionIds = new Set(response.clarification?.options.map(option => option.id));
  return optionIds.has('confirm') && optionIds.has('cancel');
}
