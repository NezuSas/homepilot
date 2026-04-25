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
      kind: "device" | "scene";
    }>;
    pendingAction?: {
      command?: DeviceCommandV1;
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
    originalPrompt: string;
  };
  confirmed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  responseType?: "answer" | "execution" | "clarification" | "error";
  options?: Array<{
    id: string;
    label: string;
    kind: "device" | "scene";
  }>;
  execution?: SceneExecutionResult;
  pendingAction?: {
    command?: DeviceCommandV1;
    originalPrompt: string;
  };
  timestamp: string;
}
