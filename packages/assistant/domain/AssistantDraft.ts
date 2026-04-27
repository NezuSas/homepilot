export type AssistantDraftType = 'automation' | 'scene';
export type AssistantDraftStatus = 'draft' | 'active';

export interface AssistantDraft {
  id: string;
  fingerprint: string;
  type: AssistantDraftType;
  status: AssistantDraftStatus;
  payload: Record<string, unknown>;
  createdAt: string;
}
