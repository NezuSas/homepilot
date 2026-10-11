import {
  INITIAL_NOISE_FLOOR,
  MAX_COMMAND_RECORDING_MS,
  MAX_CONFIRMATION_REPLY_RECORDING_MS,
  MAX_PASSIVE_WAKE_RECORDING_MS,
  computeRmsVolume,
  decideWakeTranscriptAction,
  getMaxRecordingMs,
  stepSilenceDetection,
  type SilenceDetectionState
} from './globalWakeDetection';

const freshState = (): SilenceDetectionState => ({
  noiseFloor: INITIAL_NOISE_FLOOR,
  noiseFloorCalibrated: false,
  speechDetected: false,
  speechCandidateStartedAt: null,
  silenceStartedAt: null
});

describe('globalWakeDetection', () => {
  it('computes zero volume for a silent buffer and positive volume otherwise', () => {
    expect(computeRmsVolume(new Uint8Array(16).fill(128))).toBe(0);
    expect(computeRmsVolume(new Uint8Array(16).fill(255))).toBeGreaterThan(0.9);
  });

  it('selects the maximum recording window per capture mode', () => {
    expect(getMaxRecordingMs(false, false)).toBe(MAX_PASSIVE_WAKE_RECORDING_MS);
    expect(getMaxRecordingMs(true, false)).toBe(MAX_COMMAND_RECORDING_MS);
    expect(getMaxRecordingMs(true, true)).toBe(MAX_CONFIRMATION_REPLY_RECORDING_MS);
  });

  it('calibrates the noise floor during the first passive samples', () => {
    const { state, shouldStop } = stepSilenceDetection(freshState(), {
      volume: 0.01, now: 1000, elapsed: 100, captureCommand: false, isConfirmationCapture: false
    });
    expect(shouldStop).toBe(false);
    expect(state.noiseFloor).toBeCloseTo((INITIAL_NOISE_FLOOR * 0.8) + 0.002);
    expect(state.noiseFloorCalibrated).toBe(false);
  });

  it('confirms speech only after the confirmation window and does not mutate its input', () => {
    const initial = { ...freshState(), noiseFloorCalibrated: true };
    const first = stepSilenceDetection(initial, {
      volume: 0.2, now: 1000, elapsed: 500, captureCommand: false, isConfirmationCapture: false
    });
    expect(first.state.speechDetected).toBe(false);
    expect(first.state.speechCandidateStartedAt).toBe(1000);
    expect(initial.speechCandidateStartedAt).toBeNull();

    const second = stepSilenceDetection(first.state, {
      volume: 0.2, now: 1200, elapsed: 700, captureCommand: false, isConfirmationCapture: false
    });
    expect(second.state.speechDetected).toBe(true);
  });

  it('stops a passive recording after trailing silence', () => {
    const speaking: SilenceDetectionState = { ...freshState(), noiseFloorCalibrated: true, speechDetected: true };
    const started = stepSilenceDetection(speaking, {
      volume: 0, now: 2000, elapsed: 800, captureCommand: false, isConfirmationCapture: false
    });
    expect(started.shouldStop).toBe(false);
    expect(started.state.silenceStartedAt).toBe(2000);

    const finished = stepSilenceDetection(started.state, {
      volume: 0, now: 2400, elapsed: 1200, captureCommand: false, isConfirmationCapture: false
    });
    expect(finished.shouldStop).toBe(true);
  });

  it('gives up on command capture when nobody starts speaking in time', () => {
    const calibrated = { ...freshState(), noiseFloorCalibrated: true };
    expect(stepSilenceDetection(calibrated, {
      volume: 0, now: 5000, elapsed: 2500, captureCommand: true, isConfirmationCapture: false
    }).shouldStop).toBe(true);
    expect(stepSilenceDetection(calibrated, {
      volume: 0, now: 5000, elapsed: 2500, captureCommand: true, isConfirmationCapture: true
    }).shouldStop).toBe(false);
  });

  it('classifies transcripts for command capture and passive wake detection', () => {
    expect(decideWakeTranscriptAction('enciende la luz de la sala', true)).toEqual({
      kind: 'command',
      command: 'enciende la luz de la sala'
    });
    expect(decideWakeTranscriptAction('hola que tal', false)).toEqual({ kind: 'ignore' });
    expect(decideWakeTranscriptAction('hola que tal', true).kind).not.toBe('wake');
  });
});
