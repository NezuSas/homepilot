import { Intent } from './IntentInterpreterPort';
import { AssistantPreviewResult } from '../../domain/AssistantPreviewResult';

export interface AssistantConfirmationPolicyPort {
  evaluate(intent: Intent, lang?: string): Promise<AssistantPreviewResult>;
}
