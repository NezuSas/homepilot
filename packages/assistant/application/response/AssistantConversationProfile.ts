import { getAssistantResponseText } from './AssistantResponseCatalog';

export type AssistantConversationTone = 'neutral' | 'warm' | 'formal';

export const ASSISTANT_PREFERRED_ADDRESS_KEY = 'assistant_preferred_address';
export const ASSISTANT_CONVERSATION_TONE_KEY = 'assistant_conversation_tone';

const MAX_PREFERRED_ADDRESS_LENGTH = 48;
const DISALLOWED_ADDRESS_TERMS = new Set([
  'assistant',
  'asistente',
  'developer',
  'desarrollador',
  'ignore',
  'instrucciones',
  'instructions',
  'prompt',
  'system',
  'sistema'
]);

function normalizePhrase(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeAssistantPreferredAddress(value: string | null | undefined): string | null {
  if (!value) return null;

  const address = value.trim().replace(/\s+/g, ' ');
  if (!address || address.length > MAX_PREFERRED_ADDRESS_LENGTH) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N}' -]*$/u.test(address)) return null;

  const normalized = normalizePhrase(address);
  if (DISALLOWED_ADDRESS_TERMS.has(normalized)) return null;

  return address;
}

export function detectAssistantPreferredAddressCommand(prompt: string): string | null {
  const match = prompt.trim().match(/^(?:(?:puedes\s+)?ll[aá]mame|(?:please\s+)?(?:can you\s+)?call me)\s+(.+?)[.!]?$/iu);
  return match ? normalizeAssistantPreferredAddress(match[1]) : null;
}

export function isAssistantConversationTone(value: string | null | undefined): value is AssistantConversationTone {
  return value === 'neutral' || value === 'warm' || value === 'formal';
}

export function detectAssistantConversationToneCommand(prompt: string): AssistantConversationTone | null {
  const normalized = normalizePhrase(prompt);
  if (['usa un tono calido', 'hablame con un tono calido', 'respondeme con un tono calido', 'use a warm tone'].includes(normalized)) return 'warm';
  if (['usa un tono formal', 'hablame con un tono formal', 'respondeme con un tono formal', 'use a formal tone'].includes(normalized)) return 'formal';
  if (['usa un tono neutral', 'usa un tono neutro', 'hablame con un tono neutral', 'respondeme con un tono neutral', 'use a neutral tone'].includes(normalized)) return 'neutral';
  return null;
}

export function getAssistantPreferredAddressAcknowledgement(address: string, language: string): string {
  return getAssistantResponseText('profile.preferred_address', language === 'en' ? 'en' : 'es', { address });
}

export function getAssistantConversationToneAcknowledgement(tone: AssistantConversationTone, language: string): string {
  return getAssistantResponseText('profile.tone', language === 'en' ? 'en' : 'es', { tone });
}

export function getAssistantConversationTonePrompt(tone: AssistantConversationTone): string {
  switch (tone) {
    case 'warm':
      return '- Use a warm, approachable tone while remaining concise and professional.';
    case 'formal':
      return '- Use a formal, concise and professional tone.';
    default:
      return '- Use a neutral, calm and professional tone.';
  }
}
