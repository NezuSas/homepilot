import { AssistantLearningEvent } from '../AssistantLearningEvent';

export interface AssistantLearningRepository {
  save(event: AssistantLearningEvent): Promise<void>;
  findByUserId(userId: string, limit?: number): Promise<AssistantLearningEvent[]>;
  getMostUsedEntities(userId: string, entityType: string, limit: number): Promise<Array<{ entityId: string; count: number }>>;
  getMostUsedRooms(userId: string, limit: number): Promise<Array<{ roomId: string; count: number }>>;
  getRecentCorrections(userId: string, limit: number): Promise<AssistantLearningEvent[]>;
}
