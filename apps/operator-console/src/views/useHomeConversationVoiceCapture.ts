import { useCallback, useEffect, useRef, useState } from 'react';
import { canUseLocalSpeechRecording, getPreferredAudioMimeType } from '../lib/audioRecording';
import type { ConversationActivity } from './homeConversationPresentation';

const MAX_RECORDING_MS = 8000;
const MIN_RECORDING_MS = 700;
const STOP_AFTER_SILENCE_MS = 900;
const SPEECH_LEVEL_THRESHOLD = 0.018;

type RecordingErrorKind = 'permission' | 'capture' | 'start';

interface UseHomeConversationVoiceCaptureOptions {
  disabled: boolean;
  onRecordingComplete: (audio: Blob) => void;
  onActivityChange: (activity: ConversationActivity) => void;
  onNotice: (notice: string) => void;
  onRecordingStarted: (speechSynthesisSupported: boolean) => void;
  getErrorMessage: (kind: RecordingErrorKind) => string;
  getUnavailableMessage: () => string;
}

/** Owns browser microphone resources; transcription remains a conversation concern. */
export function useHomeConversationVoiceCapture({
  disabled,
  onRecordingComplete,
  onActivityChange,
  onNotice,
  onRecordingStarted,
  getErrorMessage,
  getUnavailableMessage
}: UseHomeConversationVoiceCaptureOptions) {
  const [isListening, setIsListening] = useState(false);
  const [speechSupport, setSpeechSupport] = useState({ recording: false, synthesis: false });
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInputId, setSelectedAudioInputId] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const silenceAnimationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const callbacksRef = useRef({ onRecordingComplete, onActivityChange, onNotice, onRecordingStarted, getErrorMessage, getUnavailableMessage });

  useEffect(() => {
    callbacksRef.current = { onRecordingComplete, onActivityChange, onNotice, onRecordingStarted, getErrorMessage, getUnavailableMessage };
  }, [getErrorMessage, getUnavailableMessage, onActivityChange, onNotice, onRecordingComplete, onRecordingStarted]);

  const stopSilenceDetection = useCallback(() => {
    if (silenceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceAnimationFrameRef.current);
      silenceAnimationFrameRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    silenceStartedAtRef.current = null;
    speechDetectedRef.current = false;
  }, []);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;
  }, []);

  const clearRecordingTimeout = useCallback(() => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const stopRecording = useCallback(() => {
    clearRecordingTimeout();
    stopSilenceDetection();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }
    stopMediaStream();
    setIsListening(false);
  }, [clearRecordingTimeout, stopMediaStream, stopSilenceDetection]);

  const startSilenceDetection = useCallback((stream: MediaStream) => {
    stopSilenceDetection();
    const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextConstructor = window.AudioContext || browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;

    const audioContext = new AudioContextConstructor();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    audioContext.createMediaStreamSource(stream).connect(analyser);
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
      if (volume >= SPEECH_LEVEL_THRESHOLD) {
        speechDetectedRef.current = true;
        silenceStartedAtRef.current = null;
      } else if (speechDetectedRef.current && elapsed >= MIN_RECORDING_MS) {
        silenceStartedAtRef.current ??= now;
        if (now - silenceStartedAtRef.current >= STOP_AFTER_SILENCE_MS) {
          stopRecording();
          return;
        }
      }
      silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
    };
    silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
  }, [stopRecording, stopSilenceDetection]);

  useEffect(() => {
    setSpeechSupport({ recording: canUseLocalSpeechRecording(), synthesis: 'Audio' in window });
  }, []);

  useEffect(() => {
    if (!canUseLocalSpeechRecording()) return;
    let isMounted = true;
    const loadAudioInputs = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!isMounted) return;
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(audioInputs);
      setSelectedAudioInputId(current => audioInputs.some(device => device.deviceId === current) ? current : audioInputs[0]?.deviceId || '');
    };
    void loadAudioInputs();
    navigator.mediaDevices.addEventListener?.('devicechange', loadAudioInputs);
    return () => {
      isMounted = false;
      navigator.mediaDevices.removeEventListener?.('devicechange', loadAudioInputs);
    };
  }, []);

  useEffect(() => () => {
    clearRecordingTimeout();
    stopSilenceDetection();
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    stopMediaStream();
  }, [clearRecordingTimeout, stopMediaStream, stopSilenceDetection]);

  const toggleRecording = useCallback(async () => {
    if (disabled) return;
    if (!canUseLocalSpeechRecording()) {
      callbacksRef.current.onNotice(callbacksRef.current.getUnavailableMessage());
      return;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      stopRecording();
      return;
    }

    try {
      const audioConstraints: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };
      if (selectedAudioInputId) audioConstraints.deviceId = { exact: selectedAudioInputId };
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioInputDevices(audioInputs);
      setSelectedAudioInputId(current => audioInputs.some(device => device.deviceId === current) ? current : audioInputs[0]?.deviceId || '');
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        callbacksRef.current.onNotice(callbacksRef.current.getErrorMessage('start'));
        stopRecording();
      };
      recorder.onstop = () => {
        clearRecordingTimeout();
        const audioBlob = new Blob(mediaChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        mediaChunksRef.current = [];
        setIsListening(false);
        stopMediaStream();
        callbacksRef.current.onRecordingComplete(audioBlob);
      };
      callbacksRef.current.onNotice('');
      callbacksRef.current.onActivityChange('listening');
      callbacksRef.current.onRecordingStarted(speechSupport.synthesis);
      setIsListening(true);
      recordingStartedAtRef.current = Date.now();
      silenceStartedAtRef.current = null;
      speechDetectedRef.current = false;
      recorder.start();
      startSilenceDetection(stream);
      recordingTimeoutRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : undefined;
      const kind: RecordingErrorKind = errorName === 'NotAllowedError' || errorName === 'SecurityError'
        ? 'permission'
        : errorName === 'NotFoundError' || errorName === 'NotReadableError'
          ? 'capture'
          : 'start';
      callbacksRef.current.onNotice(callbacksRef.current.getErrorMessage(kind));
      callbacksRef.current.onActivityChange('notice');
      stopMediaStream();
      setIsListening(false);
    }
  }, [disabled, clearRecordingTimeout, selectedAudioInputId, speechSupport.synthesis, startSilenceDetection, stopMediaStream, stopRecording]);

  return { isListening, speechSupport, audioInputDevices, selectedAudioInputId, setSelectedAudioInputId, toggleRecording };
}
