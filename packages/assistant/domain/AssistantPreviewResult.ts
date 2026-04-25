export interface AssistantPreviewResult {
  prompt: string;
  intentType: 'scene' | 'command' | 'unknown';
  requiresConfirmation: boolean;
  reason?: string;
  summary: string;
  estimatedActionCount?: number;
  targetName?: string;
}
