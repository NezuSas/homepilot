import { apiFetch } from './apiClient';
import { API_BASE_URL } from '../config';
import type { SceneExecutionResult, AssistantPreviewResult } from '../types/executions';

/**
 * Assistant API helper
 */

export function isAssistantPreviewResult(value: unknown): value is AssistantPreviewResult {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  
  if (typeof obj.prompt !== 'string') return false;
  if (!['scene', 'command', 'unknown'].includes(obj.intentType as string)) return false;
  if (typeof obj.requiresConfirmation !== 'boolean') return false;
  if (typeof obj.summary !== 'string') return false;
  
  return true;
}

export class AssistantConfirmationRequiredError extends Error {
  public readonly preview: AssistantPreviewResult;
  constructor(preview: AssistantPreviewResult) {
    super('CONFIRMATION_REQUIRED');
    this.name = 'AssistantConfirmationRequiredError';
    this.preview = preview;
  }
}


export async function previewAssistantPrompt(prompt: string): Promise<AssistantPreviewResult> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/preview`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Assistant preview failed (${response.status})`);
  }

  return response.json();
}

export async function executeAssistantPrompt(prompt: string, confirmed?: boolean): Promise<SceneExecutionResult> {
  const response = await apiFetch(`${API_BASE_URL}/api/v1/assistant/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, confirmed }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 409 && errorData.error === 'CONFIRMATION_REQUIRED') {
      if (isAssistantPreviewResult(errorData.preview)) {
        throw new AssistantConfirmationRequiredError(errorData.preview);
      }
    }
    throw new Error(errorData.error?.message || errorData.message || `Assistant execution failed (${response.status})`);
  }

  return response.json();
}
