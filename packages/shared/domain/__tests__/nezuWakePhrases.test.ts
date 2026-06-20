import {
  NEZU_WAKE_PHRASES,
  extractNezuWakeCommand
} from '../nezuWakePhrases';

describe('nezuWakePhrases', () => {
  it.each(NEZU_WAKE_PHRASES)('extracts the command after "%s"', phrase => {
    expect(extractNezuWakeCommand(`${phrase} que puedes hacer`)).toEqual({
      activated: true,
      command: 'que puedes hacer'
    });
  });

  it.each(NEZU_WAKE_PHRASES)('activates without a command for "%s"', phrase => {
    expect(extractNezuWakeCommand(phrase)).toEqual({
      activated: true,
      command: ''
    });
  });

  it.each([
    'ok netu apaga la luz',
    'okay nesu abre la cortina',
    'okei nezu que hora es'
  ])('accepts a conservative phonetic transcription at the beginning: "%s"', transcript => {
    expect(extractNezuWakeCommand(transcript).activated).toBe(true);
  });

  it.each([
    'nezu apaga la luz',
    'oye nezu apaga la luz',
    'hey nezu abre la cortina',
    'homepilot apaga la luz',
    'ok homepilot apaga la luz',
    'mi automatizacion se llama ok nezu nocturno',
    'ok jesus apaga la luz',
    'quiero hablar con nezu'
  ])('rejects legacy, incomplete, embedded or unrelated phrases: "%s"', transcript => {
    expect(extractNezuWakeCommand(transcript)).toEqual({ activated: false, command: '' });
  });
});
