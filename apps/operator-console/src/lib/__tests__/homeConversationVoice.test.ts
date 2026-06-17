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
});
