import type { AssistantConversationResponse } from './AssistantConversationService';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import type { OllamaClientPort } from './ports/OllamaClientPort';

import type { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

/**
 * Conversational phrasing is optional. A local control assistant must return a
 * useful answer promptly even when its CPU-only model is busy, so this budget
 * is deliberately shorter than command and diagnostic budgets.
 */
const INTERACTIVE_OLLAMA_TIMEOUT_MS = 800;
const INTERACTIVE_OLLAMA_MAX_TOKENS = 20;
const INTERACTIVE_CONTEXT_MAX_CHARS = 120;

const SMALL_TALK_RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text'],
  properties: {
    text: { type: 'string', minLength: 1, maxLength: 56 }
  }
} as const;

function isSmallTalkResponse(value: unknown): value is { text: string } {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).text === 'string';
}

function fallbackSmallTalkMessage(language: string, devicesCount: number | null): string {
  if (devicesCount !== null) {
    return language === 'en'
      ? `Your home has ${devicesCount} devices ready to check or control.`
      : `Tu casa tiene ${devicesCount} dispositivos disponibles para consultar y controlar.`;
  }

  return language === 'en'
    ? 'I can help you check your home, control devices, and explore available scenes.'
    : 'Puedo ayudarte a consultar tu casa, controlar dispositivos y explorar escenas disponibles.';
}

function normalizeSmallTalkMessage(text: string): string {
  const compactText = text.trim().replace(/\s+/g, ' ');
  const lastNaturalBoundary = Math.max(
    compactText.lastIndexOf('.'),
    compactText.lastIndexOf('!'),
    compactText.lastIndexOf('?'),
    compactText.lastIndexOf(';'),
    compactText.lastIndexOf(':'),
    compactText.lastIndexOf(',')
  );

  if (lastNaturalBoundary > 0) {
    const completedClause = compactText.slice(0, lastNaturalBoundary).trim();
    return completedClause ? `${completedClause}.` : compactText;
  }

  return compactText;
}

export class AssistantSmallTalkService implements AssistantSmallTalkPort {
  constructor(
    private readonly ollamaClient?: OllamaClientPort,
    private readonly contextBuilder?: AssistantContextBuilderPort
  ) {}

  public async handle(prompt: string, language: string, userName?: string | null, userId?: string | null): Promise<AssistantConversationResponse> {
    const conversationalProvider = process.env.ASSISTANT_CONVERSATIONAL_LLM_PROVIDER || 'ollama';
    const isLlmEnabled = conversationalProvider === 'cloudflare'
      ? !!this.ollamaClient
      : conversationalProvider === 'ollama' && process.env.OLLAMA_ENABLED === 'true';
    
    const llmAttempted = isLlmEnabled && !!this.ollamaClient;
    let devicesCount: number | null = null;

    if (llmAttempted) {
      try {
        const homeMap = this.contextBuilder
          ? await this.contextBuilder.buildUltraLightLlmHomeMap(prompt, userId)
          : { text: 'No home context is available.', devicesCount: 0 };
        devicesCount = homeMap.devicesCount;
        
        const compactHomeContext = homeMap.text.length > INTERACTIVE_CONTEXT_MAX_CHARS
          ? `${homeMap.text.slice(0, INTERACTIVE_CONTEXT_MAX_CHARS)}…`
          : homeMap.text;

        const fullPrompt = `You are HomePilot. Reply strictly in ${language === 'en' ? 'English' : 'Spanish'}.
Home: ${compactHomeContext}
Rules: use only Home; do not invent; do not claim an action; no greeting; one complete sentence of at most 56 characters.${userName ? ` User: ${userName}.` : ''}
User: ${prompt}
JSON only: {"text":"reply"}`;
        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[Assistant] SmallTalk → LLM call (lang=${language})`);
        }
        const response = await this.ollamaClient.generateJson(fullPrompt, {
          timeoutMs: INTERACTIVE_OLLAMA_TIMEOUT_MS,
          numPredict: INTERACTIVE_OLLAMA_MAX_TOKENS,
          format: SMALL_TALK_RESPONSE_SCHEMA
        });
        
        if (isSmallTalkResponse(response) && response.text.trim().length > 0) {
          return {
            type: 'answer',
            message: normalizeSmallTalkMessage(response.text),
            llmAttempted: true
          };
        }
      } catch (error) {
        const isTimeout = error instanceof Error && error.message.toLowerCase().includes('timeout');
        console.warn(`[Assistant] Ollama small talk failed ${isTimeout ? '(TIMEOUT)' : ''}:`, error);
      }
    }

    return {
      type: 'answer',
      message: fallbackSmallTalkMessage(language, devicesCount),
      llmAttempted
    };
  }
}
