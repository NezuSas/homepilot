import { AssistantMemoryState } from './AssistantMemoryPort';

export interface ResolvedFollowUp {
  resolvedPrompt: string;
  handled: boolean;
  response?: string;
}

export interface FollowUpResolverPort {
  resolve(
    prompt: string,
    memory: AssistantMemoryState,
    language?: string,
    aliases?: Record<string, string>
  ): ResolvedFollowUp;
}
