import { AssistantConversationResponse } from './AssistantConversationService';
import { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import { OllamaClientPort } from './ports/OllamaClientPort';

function isSmallTalkResponse(value: unknown): value is { text: string } {
  return !!value &&
    typeof value === 'object' &&
    typeof (value as Record<string, unknown>).text === 'string';
}

export class AssistantSmallTalkService implements AssistantSmallTalkPort {
  constructor(private readonly ollamaClient?: OllamaClientPort) {}

  public async handle(prompt: string, language: string): Promise<AssistantConversationResponse> {
    const isLlmEnabled = process.env.OLLAMA_ENABLED === 'true';
    
    if (isLlmEnabled && this.ollamaClient) {
      try {
        const systemPrompt = `You are HomePilot, a local smart home assistant. 
You can answer simple conversational questions. 
Do not claim you executed devices. 
Do not invent device states. 
For device control, tell the user to ask clearly (e.g., "turn on the light").
Keep answers short, professional, and friendly. 
Answer in ${language === 'en' ? 'English' : 'Spanish'}.`;

        const response = await this.ollamaClient.generateJson(`System: ${systemPrompt}\nUser: ${prompt}\nResponse JSON format: {"text": "your response"}`);
        
        if (isSmallTalkResponse(response) && response.text.trim().length > 0) {
          return {
            type: 'answer',
            message: response.text
          };
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[Assistant] Ollama small talk failed:', error);
        }
      }
    }

    // Fallback user-friendly unknown
    return {
      type: 'answer',
      message: language === 'en'
        ? "I’m not sure what you want me to do. You can ask me, for example: “which lights are on?” or say “turn on the living room light”."
        : "No estoy seguro de lo que quieres hacer. Puedes preguntarme, por ejemplo: “qué luces están encendidas” o pedirme “enciende la luz de la sala”."
    };
  }
}
