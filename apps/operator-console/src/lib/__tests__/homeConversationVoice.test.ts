/// <reference types="jest" />
import { extractWakeCommand, isSilenceVoiceCommand, isUsableVoiceTranscript } from '../homeConversationVoice';

describe('homeConversationVoice', () => {
  it('accepts accented wellness prompts after wake word extraction', () => {
    const wake = extractWakeCommand('ok jompailot, cómo estás');

    expect(wake).toEqual({ activated: true, command: 'como estas' });
    expect(isUsableVoiceTranscript(wake.command)).toBe(true);
  });

  it('accepts time and date prompts from global voice capture', () => {
    expect(isUsableVoiceTranscript('qué hora es')).toBe(true);
    expect(isUsableVoiceTranscript('qué fecha es hoy')).toBe(true);
  });

  it('allows natural multi-word transcripts to reach the backend resolver', () => {
    expect(isUsableVoiceTranscript('cuando puedas revisa la sala')).toBe(true);
    expect(isUsableVoiceTranscript('me ayudas con la luz del escritorio')).toBe(true);
  });

  it('rejects empty or low-value transcripts before calling the backend', () => {
    expect(isUsableVoiceTranscript('...')).toBe(false);
    expect(isUsableVoiceTranscript('ok')).toBe(false);
  });

  it('allows short confirmation replies for voice-driven confirmations', () => {
    expect(isUsableVoiceTranscript('sí')).toBe(true);
    expect(isUsableVoiceTranscript('no')).toBe(true);
  });

  it('detects voice interruption commands after wake word extraction', () => {
    const wake = extractWakeCommand('ok jompailot, cállate');

    expect(wake).toEqual({ activated: true, command: 'callate' });
    expect(isSilenceVoiceCommand(wake.command)).toBe(true);
    expect(isUsableVoiceTranscript(wake.command)).toBe(true);
  });

  it('accepts natural silence variations as usable commands', () => {
    expect(isSilenceVoiceCommand('silencio')).toBe(true);
    expect(isSilenceVoiceCommand('deja de hablar')).toBe(true);
    expect(isSilenceVoiceCommand('no sigas hablando')).toBe(true);
  });
});
