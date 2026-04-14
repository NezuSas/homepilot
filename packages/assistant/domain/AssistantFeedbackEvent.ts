import { FindingType } from './AssistantFinding';

export type FeedbackType = 
  | 'accepted'
  | 'completed'
  | 'dismissed'
  | 'ignored'
  | 'resurfaced_then_completed'
  | 'resurfaced_then_dismissed';

export interface AssistantFeedbackEvent {
  id: string;
  findingType: FindingType;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  roomId: string | null;
  domain: string | null;
  actionType: string | null;
  feedbackType: FeedbackType;
  createdAt: string;
  metadata: Record<string, any>;
}
