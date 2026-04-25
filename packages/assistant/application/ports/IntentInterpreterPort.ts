export type Intent = 
  | { type: 'scene'; target: string; prompt: string }
  | { type: 'command'; deviceId: string; command: string; params?: Record<string, unknown>; prompt: string }
  | { type: 'unknown'; prompt: string; reason: string };

export interface IntentInterpreterPort {
  interpret(prompt: string): Promise<Intent>;
}
