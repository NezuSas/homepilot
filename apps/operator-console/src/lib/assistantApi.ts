import { apiFetch } from './apiClient';
import { API_BASE_URL } from '../config';
import type {
  AssistantConverseRequest,
  AssistantConversationResponse,
  AssistantTextToSpeechResponse
} from '../types/assistantConversation';

/**
 * Assistant API helper
 */

export async function converseWithAssistant(request: AssistantConverseRequest): Promise<AssistantConversationResponse> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/converse`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Assistant conversation failed (${response.status})`);
  }

  return response.json();
}

function isAssistantTextToSpeechResponse(value: unknown): value is AssistantTextToSpeechResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.provider === 'edge' &&
    candidate.audioContentType === 'audio/mpeg' &&
    typeof candidate.audioBase64 === 'string' &&
    candidate.audioBase64.length > 0
  );
}

export async function synthesizeAssistantSpeech(text: string): Promise<AssistantTextToSpeechResponse | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) return null;

  const payload: unknown = await response.json().catch(() => null);
  return isAssistantTextToSpeechResponse(payload) ? payload : null;
}
