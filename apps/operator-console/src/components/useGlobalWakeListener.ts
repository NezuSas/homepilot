import { useEffect, useRef } from 'react';
import { canUseLocalSpeechRecording } from '../lib/audioRecording';
import { HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT } from '../lib/homeConversationVoice';
import type { GlobalWakeStatus } from './GlobalWakeNotice';
import { useWakeCycle } from './useWakeCycle';
import { useWakeSilenceDetection } from './useWakeSilenceDetection';
import { useWakeTranscription } from './useWakeTranscription';

const GLOBAL_WAKE_LOCK_NAME = 'homepilot-global-wake-listener';

export interface GlobalWakeListenerOptions {
  enabled: boolean;
  onCommand: (command: string) => void;
  onWakeInterrupt?: () => void;
  onStatusChange?: (status: GlobalWakeStatus) => void;
}

/** Composes silence detection, recorder cycle and transcription behind a single-tab wake lock. */
export function useGlobalWakeListener({ enabled, onCommand, onWakeInterrupt, onStatusChange }: GlobalWakeListenerOptions) {
  const enabledRef = useRef(enabled);
  const releaseWakeOwnershipRef = useRef<(() => void) | null>(null);
  const onCommandRef = useRef(onCommand);
  const onWakeInterruptRef = useRef(onWakeInterrupt);
  const onStatusChangeRef = useRef(onStatusChange);

  const silence = useWakeSilenceDetection();
  const { handleAudioReady, invalidatePassiveTranscription } = useWakeTranscription({
    enabledRef,
    onCommandRef,
    onWakeInterruptRef,
    onStatusChangeRef
  });
  const {
    confirmationCapturePendingRef,
    startWakeCycle,
    switchWakeCycle,
    clearWakeCycleTimeout,
    stopRecording
  } = useWakeCycle({ enabledRef, onStatusChangeRef, silence, onAudioReady: handleAudioReady });

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    onCommandRef.current = onCommand;
    onWakeInterruptRef.current = onWakeInterrupt;
    onStatusChangeRef.current = onStatusChange;
  }, [onCommand, onStatusChange, onWakeInterrupt]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) return;
    if (!canUseLocalSpeechRecording()) {
      onStatusChangeRef.current?.('unavailable');
      return;
    }

    let disposed = false;
    const startOwnedWakeListener = () => {
      if (!disposed && enabledRef.current) void startWakeCycle(false);
    };

    if (navigator.locks) {
      void navigator.locks.request(GLOBAL_WAKE_LOCK_NAME, async () => {
        if (disposed) return;
        startOwnedWakeListener();
        await new Promise<void>((resolve) => {
          if (disposed) {
            resolve();
            return;
          }
          releaseWakeOwnershipRef.current = resolve;
        });
        releaseWakeOwnershipRef.current = null;
      }).catch(() => startOwnedWakeListener());
    } else {
      startOwnedWakeListener();
    }

    return () => {
      disposed = true;
      enabledRef.current = false;
      invalidatePassiveTranscription();
      silence.resetNoiseFloor();
      releaseWakeOwnershipRef.current?.();
      releaseWakeOwnershipRef.current = null;
      clearWakeCycleTimeout();
      stopRecording();
    };
  // The wake-cycle functions intentionally read callback refs so an active microphone
  // session is not restarted whenever parent callbacks change identity.
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const captureConfirmationReply = () => {
      if (!enabledRef.current) return;

      confirmationCapturePendingRef.current = true;
      invalidatePassiveTranscription();
      switchWakeCycle(true, 0);
    };

    window.addEventListener(HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT, captureConfirmationReply);
    return () => {
      window.removeEventListener(HOME_CONVERSATION_CONFIRMATION_LISTEN_EVENT, captureConfirmationReply);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Capture functions use stable refs while recording.
}
