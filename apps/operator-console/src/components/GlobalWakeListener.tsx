import { useEffect, useRef } from 'react';
import { transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64, canUseLocalSpeechRecording, getPreferredAudioMimeType } from '../lib/audioRecording';
import { extractWakeCommand, isUsableVoiceTranscript, normalizeVoiceTranscript } from '../lib/homeConversationVoice';
import { playWakeAcknowledgementSound } from '../lib/wakeAcknowledgementSound';
import type { GlobalWakeStatus } from './GlobalWakeNotice';

const MAX_WAKE_RECORDING_MS = 9000;
const MIN_WAKE_DETECTION_RECORDING_MS = 350;
const MIN_COMMAND_RECORDING_MS = 900;
const STOP_WAKE_DETECTION_AFTER_SILENCE_MS = 350;
const START_COMMAND_CAPTURE_TIMEOUT_MS = 2000;
const STOP_COMMAND_CAPTURE_AFTER_SILENCE_MS = 2000;
const WAKE_SPEECH_LEVEL_THRESHOLD = 0.018;

interface QueuedPassiveRecording {
  audioBlob: Blob;
  generation: number;
}

interface GlobalWakeListenerProps {
  enabled: boolean;
  interruptOnly?: boolean;
  onCommand: (command: string) => void;
  onWakeInterrupt?: () => void;
  onStatusChange?: (status: GlobalWakeStatus) => void;
}

export function GlobalWakeListener({ enabled, interruptOnly = false, onCommand, onWakeInterrupt, onStatusChange }: GlobalWakeListenerProps) {
  const enabledRef = useRef(enabled);
  const interruptOnlyRef = useRef(interruptOnly);
  const isRecordingRef = useRef(false);
  const isCapturingCommandRef = useRef(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const silenceAnimationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeCycleTimeoutRef = useRef<number | null>(null);
  const discardCurrentRecordingRef = useRef(false);
  const pendingCaptureModeRef = useRef<boolean | null>(null);
  const pendingCaptureDelayRef = useRef(0);
  const passiveTranscriptionInFlightRef = useRef(false);
  const queuedPassiveRecordingRef = useRef<QueuedPassiveRecording | null>(null);
  const wakeGenerationRef = useRef(0);
  const onCommandRef = useRef(onCommand);
  const onWakeInterruptRef = useRef(onWakeInterrupt);
  const onStatusChangeRef = useRef(onStatusChange);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    interruptOnlyRef.current = interruptOnly;
  }, [interruptOnly]);

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

    void startWakeCycle(false);

    return () => {
      enabledRef.current = false;
      wakeGenerationRef.current += 1;
      queuedPassiveRecordingRef.current = null;
      clearWakeCycleTimeout();
      stopRecording();
    };
  }, [enabled]);

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const clearWakeCycleTimeout = () => {
    if (wakeCycleTimeoutRef.current !== null) {
      window.clearTimeout(wakeCycleTimeoutRef.current);
      wakeCycleTimeoutRef.current = null;
    }
  };

  const stopMediaStream = () => {
    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    stream?.getTracks().forEach(track => track.stop());
  };

  const stopSilenceDetection = () => {
    if (silenceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceAnimationFrameRef.current);
      silenceAnimationFrameRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    silenceStartedAtRef.current = null;
  };

  const stopRecording = () => {
    clearRecordingTimeout();
    stopSilenceDetection();

    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    isRecordingRef.current = false;
    stopMediaStream();
  };

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

  const startSilenceDetection = (stream: MediaStream, captureCommand: boolean) => {
    stopSilenceDetection();

    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = audioContext;

    const samples = new Uint8Array(analyser.fftSize);
    const detectSilence = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) {
        const value = (sample - 128) / 128;
        sum += value * value;
      }

      const volume = Math.sqrt(sum / samples.length);
      const now = Date.now();
      const elapsed = now - recordingStartedAtRef.current;
      const minimumRecordingMs = captureCommand
        ? MIN_COMMAND_RECORDING_MS
        : MIN_WAKE_DETECTION_RECORDING_MS;

      if (volume >= WAKE_SPEECH_LEVEL_THRESHOLD) {
        speechDetectedRef.current = true;
        silenceStartedAtRef.current = null;
      } else if (captureCommand && !speechDetectedRef.current && elapsed >= START_COMMAND_CAPTURE_TIMEOUT_MS) {
        stopRecording();
        return;
      } else if (speechDetectedRef.current && elapsed >= minimumRecordingMs) {
        silenceStartedAtRef.current ??= now;
        const silenceTimeout = captureCommand
          ? STOP_COMMAND_CAPTURE_AFTER_SILENCE_MS
          : STOP_WAKE_DETECTION_AFTER_SILENCE_MS;
        if (now - silenceStartedAtRef.current >= silenceTimeout) {
          stopRecording();
          return;
        }
      }

      silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
    };

    silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
  };

  const transcribeRecording = async (audioBlob: Blob, captureCommand: boolean, generation: number) => {
    if (!captureCommand) passiveTranscriptionInFlightRef.current = true;
    try {
      onStatusChangeRef.current?.('transcribing');
      const audioBase64 = await blobToBase64(audioBlob);
      const transcription = await transcribeAssistantSpeech(audioBase64, audioBlob.type || 'audio/webm');
      if (!enabledRef.current || (!captureCommand && generation !== wakeGenerationRef.current)) return;

      const spokenText = normalizeVoiceTranscript(transcription?.transcript ?? '');

      if (!spokenText) {
        return;
      }

      if (interruptOnlyRef.current) {
        if (captureCommand) {
          if (isUsableVoiceTranscript(spokenText)) {
            onStatusChangeRef.current?.('processing');
            onCommandRef.current(spokenText);
            return;
          }
          return;
        }

        const interruptionWakeResult = extractWakeCommand(spokenText);
        if (interruptionWakeResult.activated) {
          wakeGenerationRef.current += 1;
          queuedPassiveRecordingRef.current = null;
          onWakeInterruptRef.current?.();
          void playWakeAcknowledgementSound();

          if (interruptionWakeResult.command && isUsableVoiceTranscript(interruptionWakeResult.command)) {
            onStatusChangeRef.current?.('processing');
            onCommandRef.current(interruptionWakeResult.command);
            return;
          }

          switchWakeCycle(true, 150);
          return;
        }

        return;
      }

      if (captureCommand) {
        if (isUsableVoiceTranscript(spokenText)) {
          onStatusChangeRef.current?.('processing');
          onCommandRef.current(spokenText);
          return;
        }
        return;
      }

      const wakeResult = extractWakeCommand(spokenText);
      if (!wakeResult.activated) {
        return;
      }

      wakeGenerationRef.current += 1;
      queuedPassiveRecordingRef.current = null;
      onWakeInterruptRef.current?.();
      void playWakeAcknowledgementSound();

      if (wakeResult.command && isUsableVoiceTranscript(wakeResult.command)) {
        onStatusChangeRef.current?.('processing');
        onCommandRef.current(wakeResult.command);
        return;
      }

      switchWakeCycle(true, 150);
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
          void transcribeRecording(queuedRecording.audioBlob, false, queuedRecording.generation);
        }
      }
    }
  };

  const handleRecordingComplete = (audioBlob: Blob, hadSpeech: boolean, captureCommand: boolean) => {
    isRecordingRef.current = false;
    stopMediaStream();

    if (!enabledRef.current) return;

    // Reinicia la escucha antes de esperar a Whisper para evitar zonas ciegas.
    scheduleWakeCycle(false, 0);

    if (!hadSpeech || audioBlob.size === 0) return;

    const generation = wakeGenerationRef.current;
    if (!captureCommand && passiveTranscriptionInFlightRef.current) {
      // Conserva solo la muestra más reciente mientras Whisper resuelve la anterior.
      queuedPassiveRecordingRef.current = { audioBlob, generation };
      return;
    }

    void transcribeRecording(audioBlob, captureCommand, generation);
  };

  const startWakeCycle = async (captureCommand: boolean) => {
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
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      speechDetectedRef.current = false;

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

        const hadSpeech = speechDetectedRef.current;
        const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        handleRecordingComplete(audioBlob, hadSpeech, isCapturingCommandRef.current);
      };

      recordingStartedAtRef.current = Date.now();
      silenceStartedAtRef.current = null;
      recorder.start();
      startSilenceDetection(stream, captureCommand);
      recordingTimeoutRef.current = window.setTimeout(() => stopRecording(), MAX_WAKE_RECORDING_MS);
    } catch {
      isRecordingRef.current = false;
      stopMediaStream();
      scheduleWakeCycle(captureCommand, 2500);
    }
  };

  return null;
}
