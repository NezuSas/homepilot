import { Intent } from './IntentInterpreterPort';

/**
 * LlmIntentInterpreterPort
 * 
 * Port for interpreting natural language prompts into structured Intents using an LLM.
 */
export interface LlmIntentInterpreterPort {
  interpret(prompt: string): Promise<Intent | null>;
}
