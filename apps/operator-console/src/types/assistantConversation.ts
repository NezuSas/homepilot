import type { SceneExecutionResult, DeviceCommandV1 } from './executions';

export interface AssistantConversationResponse {
  type: "answer" | "execution" | "clarification" | "error";
  message: string;
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
}

export interface AssistantConverseRequest {
  prompt: string;
  userName?: string;
  selectedOptionId?: string;
  pendingAction?: {
    command?: DeviceCommandV1;
    targetId?: string;
    originalPrompt: string;
  };
  confirmed?: boolean;
  sourceRoomId?: string;
}

export interface AssistantTextToSpeechResponse {
  provider: "piper";
  audioContentType: "audio/wav";
  audioBase64: string;
}

export interface AssistantSpeechToTextResponse {
  provider: "whisper-local";
  transcript: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  responseType?: "answer" | "execution" | "clarification" | "error";
  options?: Array<{
    id: string;
    label: string;
    kind: "device" | "scene" | "alias_target" | "room";
  }>;
  execution?: SceneExecutionResult;
  pendingAction?: {
    command?: DeviceCommandV1;
    targetId?: string;
    originalPrompt: string;
  };
  timestamp: string;
}
