export type HomeConversationTelemetryPhase =
  | 'global_wake_detected'
  | 'global_wake_processed'
  | 'global_wake_spoken'
  | 'global_wake_failed';

export const HOME_CONVERSATION_TELEMETRY_EVENT = 'homepilot:conversation-telemetry';

export function recordHomeConversationTelemetry(phase: HomeConversationTelemetryPhase, metadata: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(HOME_CONVERSATION_TELEMETRY_EVENT, {
    detail: { phase, ...metadata },
  }));
}
