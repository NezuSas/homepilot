export type HomeConversationTelemetryPhase =
  | 'global_wake_detected'
  | 'global_wake_processed'
  | 'global_wake_spoken'
  | 'global_wake_failed';

export function recordHomeConversationTelemetry(phase: HomeConversationTelemetryPhase, metadata: Record<string, unknown>): void {
  if (typeof console === 'undefined') return;
  console.info(`[HOME_CONVERSATION_TELEMETRY] ${JSON.stringify({ phase, ...metadata })}`);
}
