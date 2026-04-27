import { AssistantConversationResponse } from '../AssistantConversationService';

export interface AssistantSmallTalkPort {
  handle(prompt: string, language: string, userName?: string | null, userId?: string | null): Promise<AssistantConversationResponse>;
}
