import { apiFetch } from './apiClient';
import { API_BASE_URL } from '../config';
import type {
  AssistantConverseRequest,
  AssistantConversationResponse,
  AssistantSpeechToTextResponse,
  AssistantTextToSpeechResponse
} from '../types/assistantConversation';

/**
 * Assistant API helper
 */

export const ASSISTANT_VOICE_RESPONSE_TIMEOUT_MS = 5000;
const ASSISTANT_VOICE_TIMEOUT_MESSAGE = 'No pude entenderte a tiempo. Inténtalo de nuevo.';

interface AssistantConversationOptions {
  timeoutMs?: number;
}

function getAssistantErrorMessage(value: unknown, status: number): string {
  if (typeof value === 'object' && value !== null) {
    const payload = value as Record<string, unknown>;
    if (typeof payload.message === 'string' && payload.message) return payload.message;
    if (typeof payload.error === 'object' && payload.error !== null) {
      const error = payload.error as Record<string, unknown>;
      if (typeof error.message === 'string' && error.message) return error.message;
    }
  }
  return `Assistant conversation failed (${status})`;
}

export async function converseWithAssistant(
  request: AssistantConverseRequest,
  options: AssistantConversationOptions = {}
): Promise<AssistantConversationResponse> {
  const controller = options.timeoutMs ? new AbortController() : null;
  const timeoutId = options.timeoutMs
    ? globalThis.setTimeout(() => controller?.abort(), options.timeoutMs)
    : null;

  try {
    const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/converse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      ...(controller ? { signal: controller.signal } : {})
    });

    if (!response.ok) {
      const errorData: unknown = await response.json().catch(() => null);
      throw new Error(getAssistantErrorMessage(errorData, response.status));
    }

    return response.json();
  } catch (error: unknown) {
    if (controller?.signal.aborted) {
      throw new Error(ASSISTANT_VOICE_TIMEOUT_MESSAGE);
    }
    throw error;
  } finally {
    if (timeoutId !== null) globalThis.clearTimeout(timeoutId);
  }
}

function isAssistantTextToSpeechResponse(value: unknown): value is AssistantTextToSpeechResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.provider === 'piper' &&
    candidate.audioContentType === 'audio/wav' &&
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

function isAssistantSpeechToTextResponse(value: unknown): value is AssistantSpeechToTextResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return candidate.provider === 'whisper-local' && typeof candidate.transcript === 'string';
}

export async function transcribeAssistantSpeech(
  audioBase64: string,
  audioContentType: string
): Promise<AssistantSpeechToTextResponse | null> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/stt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ audioBase64, audioContentType }),
  });

  if (!response.ok) return null;

  const payload: unknown = await response.json().catch(() => null);
  return isAssistantSpeechToTextResponse(payload) ? payload : null;
}
