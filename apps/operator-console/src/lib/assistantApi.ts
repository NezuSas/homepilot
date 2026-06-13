import { apiFetch } from './apiClient';
import { API_BASE_URL } from '../config';
import type { AssistantConverseRequest, AssistantConversationResponse } from '../types/assistantConversation';

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
