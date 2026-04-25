import { AssistantConversationResponse } from '../AssistantConversationService';

export interface AssistantSmallTalkPort {
  handle(prompt: string, language: string): Promise<AssistantConversationResponse>;
}
