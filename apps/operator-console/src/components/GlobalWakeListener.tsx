import { useEffect, useRef } from 'react';
import { transcribeAssistantSpeech } from '../lib/assistantApi';
import { blobToBase64, canUseLocalSpeechRecording, getPreferredAudioMimeType } from '../lib/audioRecording';
import { extractWakeCommand, isUsableVoiceTranscript, normalizeVoiceTranscript } from '../lib/homeConversationVoice';
import type { GlobalWakeStatus } from './GlobalWakeNotice';

const MAX_WAKE_RECORDING_MS = 9000;
const MIN_WAKE_RECORDING_MS = 900;
const STOP_WAKE_AFTER_SILENCE_MS = 1900;
const WAKE_SPEECH_LEVEL_THRESHOLD = 0.018;

interface GlobalWakeListenerProps {
  enabled: boolean;
  onCommand: (command: string) => void;
  onStatusChange?: (status: GlobalWakeStatus) => void;
}

export function GlobalWakeListener({ enabled, onCommand, onStatusChange }: GlobalWakeListenerProps) {
  const enabledRef = useRef(enabled);
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

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!canUseLocalSpeechRecording()) {
      onStatusChange?.('unavailable');
      return;
    }

    void startWakeCycle(false);

    return () => {
      enabledRef.current = false;
      stopRecording();
    };
  }, [enabled, onStatusChange]);

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const stopMediaStream = () => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
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
    window.setTimeout(() => {
      if (enabledRef.current) void startWakeCycle(captureCommand);
    }, delayMs);
  };

  const startSilenceDetection = (stream: MediaStream) => {
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

      if (volume >= WAKE_SPEECH_LEVEL_THRESHOLD) {
        speechDetectedRef.current = true;
        silenceStartedAtRef.current = null;
      } else if (speechDetectedRef.current && elapsed >= MIN_WAKE_RECORDING_MS) {
        silenceStartedAtRef.current ??= now;
        if (now - silenceStartedAtRef.current >= STOP_WAKE_AFTER_SILENCE_MS) {
          stopRecording();
          return;
        }
      }

      silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
    };

    silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
  };

  const handleRecordingComplete = async (audioBlob: Blob, hadSpeech: boolean, captureCommand: boolean) => {
    isRecordingRef.current = false;
    stopMediaStream();

    if (!enabledRef.current) return;

    if (!hadSpeech || audioBlob.size === 0) {
      scheduleWakeCycle(captureCommand);
      return;
    }

    try {
      onStatusChange?.('transcribing');
      const audioBase64 = await blobToBase64(audioBlob);
      const transcription = await transcribeAssistantSpeech(audioBase64, audioBlob.type || 'audio/webm');
      const spokenText = normalizeVoiceTranscript(transcription?.transcript ?? '');

      if (!spokenText) {
        scheduleWakeCycle(captureCommand);
        return;
      }

      if (captureCommand) {
        if (isUsableVoiceTranscript(spokenText)) {
          onStatusChange?.('processing');
          onCommand(spokenText);
          scheduleWakeCycle(false, 900);
          return;
        }
        scheduleWakeCycle(false);
        return;
      }

      const wakeResult = extractWakeCommand(spokenText);
      if (!wakeResult.activated) {
        scheduleWakeCycle(false);
        return;
      }

      if (wakeResult.command && isUsableVoiceTranscript(wakeResult.command)) {
        onStatusChange?.('processing');
        onCommand(wakeResult.command);
        scheduleWakeCycle(false, 900);
        return;
      }

      scheduleWakeCycle(true, 150);
    } catch {
      scheduleWakeCycle(captureCommand, 500);
    }
  };

  const startWakeCycle = async (captureCommand: boolean) => {
    if (!enabledRef.current || isRecordingRef.current) return;

    try {
      onStatusChange?.(captureCommand ? 'capturing' : 'listening');
      isRecordingRef.current = true;
      isCapturingCommandRef.current = captureCommand;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      speechDetectedRef.current = false;

      recorder.ondataavailable = event => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        isRecordingRef.current = false;
        scheduleWakeCycle(isCapturingCommandRef.current, 1000);
      };
      recorder.onstop = () => {
        clearRecordingTimeout();
        const hadSpeech = speechDetectedRef.current;
        const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        void handleRecordingComplete(audioBlob, hadSpeech, isCapturingCommandRef.current);
      };

      recordingStartedAtRef.current = Date.now();
      silenceStartedAtRef.current = null;
      recorder.start();
      startSilenceDetection(stream);
      recordingTimeoutRef.current = window.setTimeout(() => stopRecording(), MAX_WAKE_RECORDING_MS);
    } catch {
      isRecordingRef.current = false;
      stopMediaStream();
      scheduleWakeCycle(captureCommand, 2500);
    }
  };

  return null;
}
