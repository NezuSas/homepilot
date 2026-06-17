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
});
