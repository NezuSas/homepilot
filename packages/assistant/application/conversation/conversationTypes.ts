import { SceneExecutionResult } from '../../../devices/domain/ExecutionRecord';
import { DeviceCommandV1 } from '../../../devices/domain/commands';
import { Room } from '../../../topology/domain/types';
import type { MultiCommandAction } from '../ports/IntentInterpreterPort';
import { AssistantMemoryState } from '../ports/AssistantMemoryPort';
import type { JarvisResponseStyle } from '../response/JarvisResponseFormatter';
import type { AssistantResponsePreference } from '../response/AssistantResponsePreference';
import type { AssistantConversationTone } from '../response/AssistantConversationProfile';

export interface AssistantConversationResponse {
  type: "answer" | "execution" | "clarification" | "error";
  message: string;
  llmAttempted?: boolean;
  execution?: SceneExecutionResult;
  clarification?: {
    question: string;
    options: Array<{
      id: string;
      label: string;
      kind: "device" | "scene" | "alias_target" | "room";
    }>;
    pendingAction?: {
      command?: DeviceCommandV1;
      targetId?: string;
      originalPrompt: string;
    };
  };
  responseStyle?: JarvisResponseStyle;
}

export interface ExecutedCommandResult {
  action: MultiCommandAction;
  deviceName: string;
  result: SceneExecutionResult;
}

export interface AssistantConverseRequest {
  prompt: string;
  userName?: string;
  userId?: string;
  selectedOptionId?: string;
  pendingAction?: {
    command?: DeviceCommandV1;
    targetId?: string;
    originalPrompt: string;
  };
  confirmed?: boolean;
  sourceRoomId?: string;
  interactionMode?: 'chat' | 'voice';
}

export interface RoomAliasResolution {
  rooms: Room[];
  status: 'resolved' | 'not_found' | 'ambiguous';
  candidates?: string[];
}
export type SuggestionContext =
  | 'command'
  | 'multi_command'
  | 'scene'
  | 'state_query'
  | 'room_query'
  | 'list_query';

export type PendingSuggestion = NonNullable<AssistantMemoryState['pendingSuggestion']>;

/** Per-request values resolved once by the preamble and shared by the conversation phases. */
export interface ConverseContext {
  request: AssistantConverseRequest;
  prompt: string;
  userId: string;
  userName: string | null;
  normalized: string;
  memory: AssistantMemoryState | null;
  aliases: Record<string, string>;
  language: 'es' | 'en';
  responsePreference: AssistantResponsePreference;
  conversationTone: AssistantConversationTone;
}

/** Outcome of the preamble: either a final response or the context for the remaining phases. */
export type ConverseStart = { response: AssistantConversationResponse } | { context: ConverseContext };
