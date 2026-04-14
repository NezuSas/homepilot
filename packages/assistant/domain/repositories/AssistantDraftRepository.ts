import { AssistantDraft } from '../AssistantDraft';

export interface AssistantDraftRepository {
  save(draft: AssistantDraft): Promise<void>;
  findById(id: string): Promise<AssistantDraft | null>;
  updateStatus(id: string, status: 'draft' | 'active'): Promise<void>;
  delete(id: string): Promise<void>;
}
