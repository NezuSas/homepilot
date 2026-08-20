import type { AssistantConversationResponse } from './AssistantConversationService';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import type { OllamaClientPort } from './ports/OllamaClientPort';

import type { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

const INTERACTIVE_OLLAMA_TIMEOUT_MS = 1_500;
const INTERACTIVE_OLLAMA_MAX_TOKENS = 32;

function isSmallTalkResponse(value: unknown): value is { text: string } {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).text === 'string';
}

export class AssistantSmallTalkService implements AssistantSmallTalkPort {
  constructor(
    private readonly ollamaClient?: OllamaClientPort,
    private readonly contextBuilder?: AssistantContextBuilderPort
  ) {}

  public async handle(prompt: string, language: string, userName?: string | null, userId?: string | null): Promise<AssistantConversationResponse> {
    const isLlmEnabled = process.env.OLLAMA_ENABLED === 'true';
    
    if (isLlmEnabled && this.ollamaClient) {
      try {
        const homeMap = this.contextBuilder
          ? await this.contextBuilder.buildUltraLightLlmHomeMap(prompt, userId)
          : { text: 'No home context is available.', devicesCount: 0 };
        
        const systemPrompt = userName 
          ? `You are HomePilot, a local smart home assistant with the calm, precise presence of a professional residential operator. You are talking to ${userName}.`
          : `You are HomePilot, a local smart home assistant with the calm, precise presence of a professional residential operator.`;

        const fullPrompt = `System: ${systemPrompt}
Language: ${language === 'en' ? 'English' : 'Spanish'}
Authorized home context:
${homeMap.text}
Rules: Use only this context. Do not invent devices or scenes. Do not claim an action was executed. Mention the user by name at most once when present. Keep the answer operational and under two short sentences. For a control request, ask for a clear target.
User: ${prompt}
Return JSON: {"text":"..."}`;
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[Assistant] SmallTalk → LLM call (lang=${language})`);
        }
        const response = await this.ollamaClient.generateJson(fullPrompt, {
          timeoutMs: INTERACTIVE_OLLAMA_TIMEOUT_MS,
          numPredict: INTERACTIVE_OLLAMA_MAX_TOKENS
        });
        
        if (isSmallTalkResponse(response) && response.text.trim().length > 0) {
          return {
            type: 'answer',
            message: response.text,
            llmGenerated: true
          };
        }
      } catch (error) {
        const isTimeout = error instanceof Error && error.message.toLowerCase().includes('timeout');
        console.warn(`[Assistant] Ollama small talk failed ${isTimeout ? '(TIMEOUT)' : ''}:`, error);
      }
    }

    // Fallback user-friendly unknown
    return {
      type: 'answer',
      message: language === 'en'
        ? "I’m not sure what you want me to do yet. Give me a clear home instruction, for example: “which lights are on?” or “turn on the living room light”."
        : "No estoy seguro de lo que quieres hacer todavía. Dame una orden clara del hogar, por ejemplo: “qué luces están encendidas” o “enciende la luz de la sala”."
    };
  }
}
