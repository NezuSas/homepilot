import { useRef, type RefObject } from 'react';
import { transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64 } from '../lib/audioRecording';
import { normalizeVoiceTranscript } from '../lib/homeConversationVoice';
import { playWakeAcknowledgementSound } from '../lib/wakeAcknowledgementSound';
import { decideWakeTranscriptAction } from './globalWakeDetection';
import type { GlobalWakeStatus } from './GlobalWakeNotice';

// Low-power Edge appliances may need the full server-side STT window; aborting earlier cancels valid wake-word captures.
const PASSIVE_STT_TIMEOUT_MS = 60_000;
const PASSIVE_STT_RETRY_DELAY_MS = 1500;

interface QueuedPassiveRecording {
  audioBlob: Blob;
  generation: number;
}

interface UseWakeTranscriptionOptions {
  enabledRef: RefObject<boolean>;
  onCommandRef: RefObject<(command: string) => void>;
  onWakeInterruptRef: RefObject<(() => void) | undefined>;
  onStatusChangeRef: RefObject<((status: GlobalWakeStatus) => void) | undefined>;
}

/** Sends finished recordings to speech-to-text and turns transcripts into wake/command events. */
export function useWakeTranscription({
  enabledRef,
  onCommandRef,
  onWakeInterruptRef,
  onStatusChangeRef
}: UseWakeTranscriptionOptions) {
  const passiveTranscriptionInFlightRef = useRef(false);
  const queuedPassiveRecordingRef = useRef<QueuedPassiveRecording | null>(null);
  const wakeGenerationRef = useRef(0);
  const passiveTranscriptionUnavailableUntilRef = useRef(0);

  /** Drops pending passive work so stale wake audio cannot trigger a new activation. */
  const invalidatePassiveTranscription = () => {
    wakeGenerationRef.current += 1;
    queuedPassiveRecordingRef.current = null;
  };

  const transcribeRecording = async (
    audioBlob: Blob,
    captureCommand: boolean,
    generation: number,
    startCommandCapture: () => void
  ) => {
    if (!captureCommand) passiveTranscriptionInFlightRef.current = true;
    try {
      onStatusChangeRef.current?.('transcribing');
      const audioBase64 = await blobToBase64(audioBlob);
      const transcription = await transcribeAssistantSpeech(
        audioBase64,
        audioBlob.type || 'audio/webm',
        captureCommand ? {} : { timeoutMs: PASSIVE_STT_TIMEOUT_MS }
      );
      if (!enabledRef.current || (!captureCommand && generation !== wakeGenerationRef.current)) return;
      if (!transcription) {
        if (!captureCommand) {
          passiveTranscriptionUnavailableUntilRef.current = Date.now() + PASSIVE_STT_RETRY_DELAY_MS;
          queuedPassiveRecordingRef.current = null;
        }
        return;
      }

      const spokenText = normalizeVoiceTranscript(transcription.transcript);
      if (!spokenText) return;

      const action = decideWakeTranscriptAction(spokenText, captureCommand);
      if (action.kind === 'ignore') return;

      if (action.kind === 'command') {
        onStatusChangeRef.current?.('processing');
        onCommandRef.current(action.command);
        return;
      }

      invalidatePassiveTranscription();
      onWakeInterruptRef.current?.();
      void playWakeAcknowledgementSound();

      if (action.command) {
        onStatusChangeRef.current?.('processing');
        onCommandRef.current(action.command);
        return;
      }

      startCommandCapture();
    } catch { /* La escucha pasiva ya fue reanudada antes de transcribir. */ }
    finally {
      if (!captureCommand) {
        passiveTranscriptionInFlightRef.current = false;
        const queuedRecording = queuedPassiveRecordingRef.current;
        queuedPassiveRecordingRef.current = null;
        if (
          queuedRecording
          && enabledRef.current
          && queuedRecording.generation === wakeGenerationRef.current
        ) {
          void transcribeRecording(queuedRecording.audioBlob, false, queuedRecording.generation, startCommandCapture);
        }
      }
    }
  };

  const handleAudioReady = (
    audioBlob: Blob,
    hadSpeech: boolean,
    captureCommand: boolean,
    startCommandCapture: () => void
  ) => {
    if (!hadSpeech || audioBlob.size === 0) return;

    const generation = wakeGenerationRef.current;
    if (!captureCommand && Date.now() < passiveTranscriptionUnavailableUntilRef.current) return;
    if (!captureCommand && passiveTranscriptionInFlightRef.current) {
      // Conserva solo la muestra más reciente mientras Whisper resuelve la anterior.
      queuedPassiveRecordingRef.current = { audioBlob, generation };
      return;
    }

    void transcribeRecording(audioBlob, captureCommand, generation, startCommandCapture);
  };

  return { handleAudioReady, invalidatePassiveTranscription };
}
