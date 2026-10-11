import { useRef } from 'react';
import {
  INITIAL_NOISE_FLOOR,
  computeRmsVolume,
  stepSilenceDetection
} from './globalWakeDetection';

/** Owns the AudioContext analyser loop that decides when speech starts and stops. */
export function useWakeSilenceDetection() {
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  const speechCandidateStartedAtRef = useRef<number | null>(null);
  const noiseFloorRef = useRef(INITIAL_NOISE_FLOOR);
  const noiseFloorCalibratedRef = useRef(false);
  const speechDetectedRef = useRef(false);
  const silenceAnimationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const stopSilenceDetection = () => {
    if (silenceAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(silenceAnimationFrameRef.current);
      silenceAnimationFrameRef.current = null;
    }
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    silenceStartedAtRef.current = null;
    speechCandidateStartedAtRef.current = null;
  };

  const resetNoiseFloor = () => {
    noiseFloorRef.current = INITIAL_NOISE_FLOOR;
    noiseFloorCalibratedRef.current = false;
  };

  const resetSpeechDetection = () => {
    speechDetectedRef.current = false;
    speechCandidateStartedAtRef.current = null;
  };

  const markRecordingStarted = () => {
    recordingStartedAtRef.current = Date.now();
    silenceStartedAtRef.current = null;
  };

  const startSilenceDetection = (
    stream: MediaStream,
    captureCommand: boolean,
    isConfirmationCapture: boolean,
    onSilence: () => void
  ) => {
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
      const now = Date.now();
      const { state, shouldStop } = stepSilenceDetection({
        noiseFloor: noiseFloorRef.current,
        noiseFloorCalibrated: noiseFloorCalibratedRef.current,
        speechDetected: speechDetectedRef.current,
        speechCandidateStartedAt: speechCandidateStartedAtRef.current,
        silenceStartedAt: silenceStartedAtRef.current
      }, {
        volume: computeRmsVolume(samples),
        now,
        elapsed: now - recordingStartedAtRef.current,
        captureCommand,
        isConfirmationCapture
      });

      noiseFloorRef.current = state.noiseFloor;
      noiseFloorCalibratedRef.current = state.noiseFloorCalibrated;
      speechDetectedRef.current = state.speechDetected;
      speechCandidateStartedAtRef.current = state.speechCandidateStartedAt;
      silenceStartedAtRef.current = state.silenceStartedAt;

      if (shouldStop) {
        onSilence();
        return;
      }

      silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
    };

    silenceAnimationFrameRef.current = window.requestAnimationFrame(detectSilence);
  };

  return {
    speechDetectedRef,
    startSilenceDetection,
    stopSilenceDetection,
    resetNoiseFloor,
    resetSpeechDetection,
    markRecordingStarted
  };
}
