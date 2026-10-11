import { useRef, type RefObject } from 'react';
import { getPreferredAudioMimeType } from '../lib/audioRecording';
import { getMaxRecordingMs } from './globalWakeDetection';
import type { GlobalWakeStatus } from './GlobalWakeNotice';
import type { useWakeSilenceDetection } from './useWakeSilenceDetection';

interface UseWakeCycleOptions {
  enabledRef: RefObject<boolean>;
  onStatusChangeRef: RefObject<((status: GlobalWakeStatus) => void) | undefined>;
  silence: ReturnType<typeof useWakeSilenceDetection>;
  onAudioReady: (
    audioBlob: Blob,
    hadSpeech: boolean,
    captureCommand: boolean,
    startCommandCapture: () => void
  ) => void;
}

/** Owns the microphone/MediaRecorder lifecycle: start, stop, schedule and mode switching. */
export function useWakeCycle({ enabledRef, onStatusChangeRef, silence, onAudioReady }: UseWakeCycleOptions) {
  const isRecordingRef = useRef(false);
  const isCapturingCommandRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const wakeCycleTimeoutRef = useRef<number | null>(null);
  const discardCurrentRecordingRef = useRef(false);
  const pendingCaptureModeRef = useRef<boolean | null>(null);
  const pendingCaptureDelayRef = useRef(0);
  const confirmationCapturePendingRef = useRef(false);

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  function clearWakeCycleTimeout() {
    if (wakeCycleTimeoutRef.current !== null) {
      window.clearTimeout(wakeCycleTimeoutRef.current);
      wakeCycleTimeoutRef.current = null;
    }
  }

  const stopMediaStream = () => {
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    stream?.getTracks().forEach(track => track.stop());
  };

  function stopRecording() {
    clearRecordingTimeout();
    silence.stopSilenceDetection();

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    isRecordingRef.current = false;
    stopMediaStream();
  }

  const scheduleWakeCycle = (captureCommand: boolean, delayMs = 250) => {
    if (!enabledRef.current) return;
    clearWakeCycleTimeout();
    wakeCycleTimeoutRef.current = window.setTimeout(() => {
      wakeCycleTimeoutRef.current = null;
      if (enabledRef.current) void startWakeCycle(captureCommand);
    }, delayMs);
  };

  const switchWakeCycle = (captureCommand: boolean, delayMs = 0) => {
    if (!enabledRef.current) return;

    if (mediaRecorderRef.current?.state === 'recording') {
      discardCurrentRecordingRef.current = true;
      pendingCaptureModeRef.current = captureCommand;
      pendingCaptureDelayRef.current = delayMs;
      stopRecording();
      return;
    }

    scheduleWakeCycle(captureCommand, delayMs);
  };

  const handleRecordingComplete = (audioBlob: Blob, hadSpeech: boolean, captureCommand: boolean) => {
    isRecordingRef.current = false;
    stopMediaStream();

    if (!enabledRef.current) return;

    // Reinicia la escucha antes de esperar a Whisper para evitar zonas ciegas.
    scheduleWakeCycle(false, 0);

    onAudioReady(audioBlob, hadSpeech, captureCommand, () => switchWakeCycle(true, 150));
  };

  async function startWakeCycle(captureCommand: boolean) {
    if (!enabledRef.current || isRecordingRef.current) return;

    try {
      onStatusChangeRef.current?.(captureCommand ? 'capturing' : 'listening');
      isRecordingRef.current = true;
      isCapturingCommandRef.current = captureCommand;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      if (!enabledRef.current) {
        stream.getTracks().forEach(track => track.stop());
        isRecordingRef.current = false;
        return;
      }
      const isConfirmationCapture = captureCommand && confirmationCapturePendingRef.current;
      confirmationCapturePendingRef.current = false;
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      silence.resetSpeechDetection();

      stream.getAudioTracks().forEach(track => {
        track.addEventListener('ended', () => {
          if (!enabledRef.current || mediaStreamRef.current !== stream) return;

          discardCurrentRecordingRef.current = true;
          pendingCaptureModeRef.current = isCapturingCommandRef.current;
          pendingCaptureDelayRef.current = 500;
          if (recorder.state === 'recording') {
            stopRecording();
          } else {
            isRecordingRef.current = false;
            stopMediaStream();
            scheduleWakeCycle(isCapturingCommandRef.current, 500);
          }
        }, { once: true });
      });

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        isRecordingRef.current = false;
        stopMediaStream();
        scheduleWakeCycle(isCapturingCommandRef.current, 1000);
      };
      recorder.onstop = () => {
        clearRecordingTimeout();
        const discardRecording = discardCurrentRecordingRef.current;
        const pendingCaptureMode = pendingCaptureModeRef.current;
        const pendingCaptureDelay = pendingCaptureDelayRef.current;
        discardCurrentRecordingRef.current = false;
        pendingCaptureModeRef.current = null;
        pendingCaptureDelayRef.current = 0;

        if (discardRecording) {
          isRecordingRef.current = false;
          mediaChunksRef.current = [];
          stopMediaStream();
          scheduleWakeCycle(pendingCaptureMode ?? false, pendingCaptureDelay);
          return;
        }

        const hadSpeech = silence.speechDetectedRef.current;
        const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        handleRecordingComplete(audioBlob, hadSpeech || isConfirmationCapture, isCapturingCommandRef.current);
      };

      silence.markRecordingStarted();
      recorder.start();
      silence.startSilenceDetection(stream, captureCommand, isConfirmationCapture, stopRecording);
      recordingTimeoutRef.current = window.setTimeout(
        () => stopRecording(),
        getMaxRecordingMs(captureCommand, isConfirmationCapture)
      );
    } catch {
      isRecordingRef.current = false;
      stopMediaStream();
      scheduleWakeCycle(captureCommand, 2500);
    }
  }

  return {
    confirmationCapturePendingRef,
    startWakeCycle,
    switchWakeCycle,
    clearWakeCycleTimeout,
    stopRecording
  };
}
