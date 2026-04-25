import { apiFetch } from './apiClient';
import { API_BASE_URL } from '../config';
import type { SceneExecutionResult } from '../types/executions';

/**
 * Assistant API helper
 */

export async function executeAssistantPrompt(prompt: string): Promise<SceneExecutionResult> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Assistant execution failed (${response.status})`);
  }

  return response.json();
}
