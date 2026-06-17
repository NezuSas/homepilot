/// <reference types="jest" />
import { extractWakeCommand, isUsableVoiceTranscript } from '../homeConversationVoice';

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
});
