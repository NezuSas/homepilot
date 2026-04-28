export type LearningEventType = 
  | 'device_used'
  | 'scene_used'
  | 'automation_used'
  | 'alias_created'
  | 'clarification_selected'
  | 'correction_received'
  | 'command_failed'
  | 'command_succeeded'
  | 'suggestion_accepted'
  | 'suggestion_rejected'
  | 'suggestion_postponed';

export interface LearningModifiers {
  typeModifiers: Record<string, number>;
  explanations: Record<string, string>;
}

export interface AssistantLearningEvent {
  id: string;
  userId: string;
  eventType: LearningEventType;
  entityType: string | null;
  entityId: string | null;
  entityName: string | null;
  roomId: string | null;
  prompt: string | null;
  correction: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}
