export type IntentType = 
  | 'create_automation'
  | 'create_scene'
  | 'rename_device'
  | 'assign_room'
  | 'request_recommendation'
  | 'summarize_assistant_state';

export interface AssistantIntent {
  type: IntentType;
  targetRoom?: string;
  targetRoomId?: string;
  targetDevice?: string;
  targetDeviceId?: string;
  newName?: string;
  trigger?: string;
  action?: string;
  confidence: number;
  rawInput: string;
  missingFields: string[];
}

export interface AssistantDraftProposal {
  id: string;
  type: IntentType;
  title: string;
  summary: string;
  details: Record<string, any>;
  entities: { id: string; name: string; type: string }[];
  isComplete: boolean;
  missingInfo?: string[];
}
