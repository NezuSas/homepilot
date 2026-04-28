import { DeviceCommandV1 } from '../../../devices/domain/commands';
export { DeviceCommandV1 };

export type MultiCommandAction = {
  deviceId: string;
  command: DeviceCommandV1;
  params?: Record<string, unknown>;
  targetName?: string;
};

export type Intent = 
  | { type: 'scene'; target: string; prompt: string }
  | { type: 'command'; deviceId: string; command: DeviceCommandV1; params?: Record<string, unknown>; prompt: string }
  | { type: 'multi_command'; prompt: string; actions: MultiCommandAction[]; requiresConfirmation?: boolean; reason?: string }
  | { type: 'explain'; prompt: string; targetId?: string }
  | { type: 'retry'; prompt: string }
  | { type: 'unknown'; prompt: string; reason: string };

export type AssistantClarificationOption = {
  id: string;
  label: string;
  kind: 'device' | 'scene' | 'alias_target';
};

export type AssistantMultiCommandResult = 
  | { type: 'success'; intent: Intent & { type: 'multi_command' } }
  | { type: 'clarificationRequired'; options: AssistantClarificationOption[]; originalSegment: string }
  | { type: 'failure'; message: string };

export interface IntentInterpreterPort {
  interpret(prompt: string): Promise<Intent | AssistantMultiCommandResult>;
}
