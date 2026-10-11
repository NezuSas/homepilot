import { extractWakeCommand, isUsableVoiceTranscript } from '../lib/homeConversationVoice';

export const MAX_PASSIVE_WAKE_RECORDING_MS = 3000;
export const MAX_COMMAND_RECORDING_MS = 9000;
export const MAX_CONFIRMATION_REPLY_RECORDING_MS = 5000;
export const MIN_WAKE_DETECTION_RECORDING_MS = 350;
export const MIN_COMMAND_RECORDING_MS = 900;
export const STOP_WAKE_DETECTION_AFTER_SILENCE_MS = 350;
export const START_COMMAND_CAPTURE_TIMEOUT_MS = 2000;
export const START_CONFIRMATION_REPLY_CAPTURE_TIMEOUT_MS = 5000;
export const STOP_COMMAND_CAPTURE_AFTER_SILENCE_MS = 2000;
export const WAKE_SPEECH_LEVEL_THRESHOLD = 0.018;
export const WAKE_SPEECH_CONFIRMATION_MS = 120;
export const WAKE_NOISE_CALIBRATION_MS = 300;
export const WAKE_NOISE_FLOOR_MULTIPLIER = 1.6;
export const INITIAL_NOISE_FLOOR = 0.008;

export interface SilenceDetectionState {
  noiseFloor: number;
  noiseFloorCalibrated: boolean;
  speechDetected: boolean;
  speechCandidateStartedAt: number | null;
  silenceStartedAt: number | null;
}

export interface SilenceDetectionInput {
  volume: number;
  now: number;
  elapsed: number;
  captureCommand: boolean;
  isConfirmationCapture: boolean;
}

export interface SilenceDetectionResult {
  state: SilenceDetectionState;
  shouldStop: boolean;
}

export type WakeTranscriptAction =
  | { kind: 'ignore' }
  | { kind: 'command'; command: string }
  | { kind: 'wake'; command: string | null };

/** Root-mean-square level of a byte time-domain buffer, normalised to 0..1. */
export function computeRmsVolume(samples: Uint8Array): number {
  let sum = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
}

export function getMaxRecordingMs(captureCommand: boolean, isConfirmationCapture: boolean): number {
  if (!captureCommand) return MAX_PASSIVE_WAKE_RECORDING_MS;
  return isConfirmationCapture ? MAX_CONFIRMATION_REPLY_RECORDING_MS : MAX_COMMAND_RECORDING_MS;
}

/** One animation-frame step of the adaptive speech/silence detector. */
export function stepSilenceDetection(
  previous: SilenceDetectionState,
  { volume, now, elapsed, captureCommand, isConfirmationCapture }: SilenceDetectionInput
): SilenceDetectionResult {
  const state = { ...previous };
  const adaptiveSpeechThreshold = Math.max(
    WAKE_SPEECH_LEVEL_THRESHOLD,
    state.noiseFloor * WAKE_NOISE_FLOOR_MULTIPLIER
  );
  const minimumRecordingMs = captureCommand
    ? MIN_COMMAND_RECORDING_MS
    : MIN_WAKE_DETECTION_RECORDING_MS;
  const isCalibratingNoiseFloor = !captureCommand
    && !state.speechDetected
    && !state.noiseFloorCalibrated
    && elapsed < WAKE_NOISE_CALIBRATION_MS;
  if (!captureCommand && !state.noiseFloorCalibrated && elapsed >= WAKE_NOISE_CALIBRATION_MS) {
    state.noiseFloorCalibrated = true;
  }

  if (isCalibratingNoiseFloor) {
    state.noiseFloor = (state.noiseFloor * 0.8) + (volume * 0.2);
    state.speechCandidateStartedAt = null;
  } else if (volume >= adaptiveSpeechThreshold) {
    state.speechCandidateStartedAt ??= now;
    if (now - state.speechCandidateStartedAt >= WAKE_SPEECH_CONFIRMATION_MS) {
      state.speechDetected = true;
      state.silenceStartedAt = null;
    }
  } else if (captureCommand && !state.speechDetected && elapsed >= (isConfirmationCapture ? START_CONFIRMATION_REPLY_CAPTURE_TIMEOUT_MS : START_COMMAND_CAPTURE_TIMEOUT_MS)) {
    state.speechCandidateStartedAt = null;
    return { state, shouldStop: true };
  } else if (state.speechDetected && elapsed >= minimumRecordingMs) {
    state.speechCandidateStartedAt = null;
    state.silenceStartedAt ??= now;
    const silenceTimeout = captureCommand
      ? STOP_COMMAND_CAPTURE_AFTER_SILENCE_MS
      : STOP_WAKE_DETECTION_AFTER_SILENCE_MS;
    if (now - state.silenceStartedAt >= silenceTimeout) {
      return { state, shouldStop: true };
    }
  } else {
    state.speechCandidateStartedAt = null;
    if (!captureCommand && !state.speechDetected) {
      state.noiseFloor = (state.noiseFloor * 0.95) + (volume * 0.05);
    }
  }

  return { state, shouldStop: false };
}

/** Decides what a normalised transcript means for the wake listener. */
export function decideWakeTranscriptAction(spokenText: string, captureCommand: boolean): WakeTranscriptAction {
  if (captureCommand) {
    return isUsableVoiceTranscript(spokenText)
      ? { kind: 'command', command: spokenText }
      : { kind: 'ignore' };
  }

  const wakeResult = extractWakeCommand(spokenText);
  if (!wakeResult.activated) return { kind: 'ignore' };

  return {
    kind: 'wake',
    command: wakeResult.command && isUsableVoiceTranscript(wakeResult.command) ? wakeResult.command : null
  };
}
