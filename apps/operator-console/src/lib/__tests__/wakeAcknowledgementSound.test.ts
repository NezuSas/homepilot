/// <reference types="jest" />
import { playWakeAcknowledgementSound } from '../wakeAcknowledgementSound';

describe('playWakeAcknowledgementSound', () => {
  it('plays a local two-tone acknowledgement', async () => {
    const gain = {
      gain: {
        setValueAtTime: jest.fn(),
        exponentialRampToValueAtTime: jest.fn()
      },
      connect: jest.fn()
    };
    const oscillator = () => ({
      type: 'sine' as OscillatorType,
      frequency: { setValueAtTime: jest.fn() },
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    });
    const firstTone = oscillator();
    const secondTone = oscillator();
    const context = {
      state: 'running' as AudioContextState,
      currentTime: 0,
      destination: {},
      createGain: jest.fn(() => gain),
      createOscillator: jest.fn()
        .mockReturnValueOnce(firstTone)
        .mockReturnValueOnce(secondTone),
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    };
    const audioContext = jest.fn(() => context);
    const setTimeoutMock = jest.fn((callback: () => void) => {
      callback();
      return 1;
    });
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        AudioContext: audioContext,
        setTimeout: setTimeoutMock
      }
    });

    await playWakeAcknowledgementSound();

    expect(audioContext).toHaveBeenCalledTimes(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(2);
    expect(firstTone.frequency.setValueAtTime).toHaveBeenCalledWith(660, 0);
    expect(secondTone.frequency.setValueAtTime).toHaveBeenCalledWith(880, 0.075);
    expect(context.close).toHaveBeenCalledTimes(1);

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: previousWindow
    });
  });
});
