import type { AssistantConversationResponse } from './AssistantConversationService';
import type { AssistantSmallTalkPort } from './ports/AssistantSmallTalkPort';
import { normalizeAssistantPrompt } from './AssistantPromptNormalizer';

function localConversationMessage(prompt: string, language: string): string {
  const normalized = normalizeAssistantPrompt(prompt);
  const isSpanish = language !== 'en';

  if (/\b(a que hora|hora).*(dormir|acostar)|\bwhen.*sleep\b/.test(normalized)) {
    return isSpanish
      ? 'No puedo recomendar una hora personal para dormir. Cuando estés listo, puedo ayudarte a preparar la casa: apagar luces, cerrar cortinas o activar una escena nocturna.'
      : 'I cannot recommend a personal bedtime. When you are ready, I can help prepare your home by turning off lights, closing covers, or using a night scene.';
  }

  if (/\b(hola|buenas|hey|hello|hi)\b/.test(normalized)) {
    return isSpanish
      ? 'Hola. Puedo ayudarte a revisar la casa, controlar dispositivos y preparar una escena o rutina.'
      : 'Hello. I can help you check your home, control devices, and prepare a scene or routine.';
  }

  if (/\b(gracias|thank you|thanks)\b/.test(normalized)) {
    return isSpanish
      ? 'Con gusto. Cuando quieras, seguimos con tu casa.'
      : 'You are welcome. I am here whenever you want to continue with your home.';
  }

  if (/\b(que puedo hacer|en que me ayudas|como me ayudas|ayuda|what can you do|how can you help)\b/.test(normalized)) {
    return isSpanish
      ? 'Puedo revisar el estado de tu casa, controlar luces y cortinas, consultar sensores, mostrar escenas y ayudarte a preparar ambientes.'
      : 'I can check your home status, control lights and covers, read sensors, show scenes, and help prepare home environments.';
  }

  return isSpanish
    ? 'No tengo información para responder eso fuera de tu casa. Puedo ayudarte con el estado, dispositivos, escenas, rutinas y ambientes de tu hogar.'
    : 'I do not have information to answer that outside your home. I can help with your home status, devices, scenes, routines, and environments.';
}

/** Answers conversational messages with fixed, home-focused replies; it never calls a model. */
export class AssistantSmallTalkService implements AssistantSmallTalkPort {
  public async handle(prompt: string, language: string): Promise<AssistantConversationResponse> {
    return { type: 'answer', message: localConversationMessage(prompt, language) };
  }
}
