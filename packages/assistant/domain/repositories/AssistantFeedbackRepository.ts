import { AssistantFeedbackEvent, FeedbackType } from '../AssistantFeedbackEvent';

export interface AssistantFeedbackRepository {
  save(event: AssistantFeedbackEvent): Promise<void>;
  findAll(): Promise<AssistantFeedbackEvent[]>;
  findByType(type: string): Promise<AssistantFeedbackEvent[]>;
  findByRoom(roomId: string): Promise<AssistantFeedbackEvent[]>;
  getAggregateStats(): Promise<Record<string, number>>;
}
