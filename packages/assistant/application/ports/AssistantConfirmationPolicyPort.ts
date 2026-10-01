import { Intent } from './IntentInterpreterPort';
import { AssistantPreviewResult } from '../../domain/AssistantPreviewResult';

export interface AssistantConfirmationPolicyPort {
  evaluate(intent: Intent, lang?: string, userId?: string): Promise<AssistantPreviewResult>;
}
