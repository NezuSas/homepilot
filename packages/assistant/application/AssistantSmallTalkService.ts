import type { AssistantConversationResponse } from './AssistantConversationService';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import type { OllamaClientPort } from './ports/OllamaClientPort';

import type { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

const INTERACTIVE_OLLAMA_TIMEOUT_MS = 2_500;
const INTERACTIVE_OLLAMA_MAX_TOKENS = 32;
const INTERACTIVE_CONTEXT_MAX_CHARS = 160;

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
    
    const llmAttempted = isLlmEnabled && !!this.ollamaClient;

    if (llmAttempted) {
      try {
        const homeMap = this.contextBuilder
          ? await this.contextBuilder.buildUltraLightLlmHomeMap(prompt, userId)
          : { text: 'No home context is available.', devicesCount: 0 };
        
        const compactHomeContext = homeMap.text.length > INTERACTIVE_CONTEXT_MAX_CHARS
          ? `${homeMap.text.slice(0, INTERACTIVE_CONTEXT_MAX_CHARS)}…`
          : homeMap.text;

        const fullPrompt = `You are HomePilot. Reply strictly in ${language === 'en' ? 'English' : 'Spanish'}.
Home: ${compactHomeContext}
Rules: use only Home; do not invent; do not claim an action; no greeting or introduction; maximum seven words.${userName ? ` User: ${userName}.` : ''}
User: ${prompt}
JSON only: {"text":"reply"}`;
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
            llmAttempted: true
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
        : "No estoy seguro de lo que quieres hacer todavía. Dame una orden clara del hogar, por ejemplo: “qué luces están encendidas” o “enciende la luz de la sala”.",
      llmAttempted
    };
  }
}
