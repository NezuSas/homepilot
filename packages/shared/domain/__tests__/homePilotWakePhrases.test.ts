import {
  HOME_PILOT_WAKE_PHRASES,
  extractHomePilotWakeCommand
} from '../homePilotWakePhrases';

describe('homePilotWakePhrases', () => {
  it.each(HOME_PILOT_WAKE_PHRASES)('extracts the same command after "%s"', phrase => {
    expect(extractHomePilotWakeCommand(`${phrase} que puedes hacer`)).toEqual({
      activated: true,
      command: 'que puedes hacer'
    });
  });

  it.each(HOME_PILOT_WAKE_PHRASES)('activates without a command for "%s"', phrase => {
    expect(extractHomePilotWakeCommand(phrase)).toEqual({
      activated: true,
      command: ''
    });
  });

  it.each([
    'jom paylod apaga la luz',
    'oye yon pailod abre la cortina',
    'home pailod que hora es'
  ])('accepts a close phonetic wake transcription at the beginning: "%s"', transcript => {
    expect(extractHomePilotWakeCommand(transcript).activated).toBe(true);
  });

  it.each([
    'oye un piloto apaga la luz',
    'mi automatizacion home paylod nocturna',
    'quiero hablar con el piloto'
  ])('rejects common or embedded phrases: "%s"', transcript => {
    expect(extractHomePilotWakeCommand(transcript)).toEqual({ activated: false, command: '' });
  });
});
