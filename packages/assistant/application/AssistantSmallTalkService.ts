import type { AssistantConversationResponse } from './AssistantConversationService';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import type { OllamaClientPort } from './ports/OllamaClientPort';

import type { AssistantContextBuilderPort } from './ports/AssistantContextBuilderPort';

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
        const homeContext = this.contextBuilder ? await this.contextBuilder.build(userId) : '{}';
        
        const systemPrompt = userName 
          ? `You are HomePilot, a local smart home assistant with the calm, precise presence of a professional residential operator. You are talking to ${userName}.`
          : `You are HomePilot, a local smart home assistant with the calm, precise presence of a professional residential operator.`;

        const rulesPrompt = `- Usa SOLO información del contexto si está disponible
- No inventes dispositivos ni escenas
- Si no hay datos, dilo claramente
- Puedes usar el estado (state) y la ubicación (roomId) de los dispositivos para dar respuestas más precisas
- Mention the room when relevant to give context (e.g. "The light in the Living Room is on").
- Use the 'lastConversationEntities' if the user asks follow-up questions like "where is that?" or "turn it off".
- Do not claim you executed devices.
- For device control, tell the user to ask clearly.
- Keep answers short, elegant, and operational. Sound like a polished home operator, not a generic chatbot.
- Avoid jokes, drama, or science-fiction roleplay. A subtle Jarvis-like tone is acceptable; clarity is mandatory.
- Prefer calm phrases such as "sistema en orden", "listo para operar", "necesito un objetivo más claro", or their English equivalents when they fit naturally.
- Answer in ${language === 'en' ? 'English' : 'Spanish'}.
${userName ? `- Mention the user by name (${userName}) at most once in your response.` : ''}`;

        const fullPrompt = `System:
${systemPrompt}

Context:
${homeContext}

Rules:
${rulesPrompt}

User:
${prompt}

Response JSON format: {"text": "your response"}`;

        if (process.env.NODE_ENV !== 'production') {
          console.debug(`[Assistant] SmallTalk → LLM call (lang=${language})`);
        }
        const response = await this.ollamaClient.generateJson(fullPrompt);
        
        if (isSmallTalkResponse(response) && response.text.trim().length > 0) {
          return {
            type: 'answer',
            message: response.text
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
