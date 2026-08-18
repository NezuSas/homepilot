export type HomeConversationTelemetryPhase =
  | 'global_wake_detected'
  | 'global_wake_processed'
  | 'global_wake_spoken'
  | 'global_wake_failed';

type GlobalWakeTelemetryMetadata = {
  global_wake_detected: {
    sourceView: string;
    promptLength: number;
  };
  global_wake_processed: {
    sourceView: string;
    responseType: string;
    elapsedMs: number;
  };
  global_wake_spoken: {
    elapsedMs: number;
    textLength: number;
  };
  global_wake_failed: {
    sourceView: string;
    elapsedMs: number;
  };
};

export const HOME_CONVERSATION_TELEMETRY_EVENT = 'homepilot:conversation-telemetry';

export function recordHomeConversationTelemetry<TPhase extends HomeConversationTelemetryPhase>(
  phase: TPhase,
  metadata: GlobalWakeTelemetryMetadata[TPhase]
): void {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(new CustomEvent(HOME_CONVERSATION_TELEMETRY_EVENT, {
    detail: { phase, ...metadata },
  }));
}
