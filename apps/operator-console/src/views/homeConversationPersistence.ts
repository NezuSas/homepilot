import type { ChatMessage } from '../types/assistantConversation';

const HOME_CONVERSATION_STORAGE_PREFIX = 'hp_home_conversation_v1';
const HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY = 'hp_home_conversation_speech_enabled';
const MAX_PERSISTED_MESSAGES = 80;

export function getConversationStorageKey(userId: string | undefined): string | null {
  return userId ? `${HOME_CONVERSATION_STORAGE_PREFIX}:${userId}` : null;
}

export function readStoredConversationMessages(storageKey: string | null): ChatMessage[] {
  if (!storageKey) return [];
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is ChatMessage => typeof value === 'object' && value !== null
      && typeof value.id === 'string'
      && (value.role === 'user' || value.role === 'assistant')
      && typeof value.content === 'string'
      && typeof value.timestamp === 'string').slice(-MAX_PERSISTED_MESSAGES);
  } catch {
    return [];
  }
}

export function storeConversationMessages(storageKey: string | null, messages: ChatMessage[]): void {
  if (!storageKey) return;
  sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES)));
}

export function readSpeechEnabledPreference(): boolean {
  try {
    return localStorage.getItem(HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function storeSpeechEnabledPreference(enabled: boolean): void {
  try {
    localStorage.setItem(HOME_CONVERSATION_SPEECH_ENABLED_STORAGE_KEY, String(enabled));
  } catch {
    // Conversation remains usable when local preferences cannot persist.
  }
}
