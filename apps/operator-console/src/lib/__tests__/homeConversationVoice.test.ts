/// <reference types="jest" />
import { extractWakeCommand, isSilenceVoiceCommand, isUsableVoiceTranscript } from '../homeConversationVoice';
import { NEZU_WAKE_PHRASES } from '../../../../../packages/shared/domain/nezuWakePhrases';

describe('homeConversationVoice', () => {
  it.each(NEZU_WAKE_PHRASES)('uses the canonical wake phrase "%s" for every voice action', phrase => {
    expect(extractWakeCommand(`${phrase}, apaga la luz de la sala`)).toEqual({
      activated: true,
      command: 'apaga la luz de la sala'
    });
  });

  it('does not activate when a wake phrase is embedded inside another sentence', () => {
    expect(extractWakeCommand('mi automatizacion se llama ok nezu nocturno')).toEqual({
      activated: false,
      command: ''
    });
  });

  it.each([
    '¡Ok Nesu! ¿Qué hora es?',
    '¡Okey Ne Su! ¿Qué hora es?',
    '¡Okay Nezo! ¿Qué hora es?',
    '¡Okei Neso! ¿Qué hora es?'
  ])('accepts observed Whisper wake transcription "%s"', transcript => {
    expect(extractWakeCommand(transcript)).toEqual({
      activated: true,
      command: 'que hora es'
    });
  });

  it.each([
    '¡Suscríbete!',
    '¡Nezu! ¿Qué hora es?',
    '¡Oye Nezu! ¿Qué hora es?',
    '¡Ok HomePilot! ¿Qué hora es?'
  ])('rejects unrelated Whisper transcription "%s"', transcript => {
    expect(extractWakeCommand(transcript)).toEqual({ activated: false, command: '' });
  });

  it('accepts accented wellness prompts after wake word extraction', () => {
    const wake = extractWakeCommand('ok nezu, cómo estás');

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
    const wake = extractWakeCommand('ok nezu, cállate');

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
