import { buildAudioInputOptions, resolveActivityStatus } from './homeConversationViewModel';

const labels = { listening: 'L', transcribing: 'T', consulting: 'C', ready: 'R' };

describe('homeConversationViewModel', () => {
  it('maps each activity to its label and tone', () => {
    expect(resolveActivityStatus('listening', '', labels)).toEqual({ label: 'L', tone: 'danger' });
    expect(resolveActivityStatus('transcribing', '', labels)).toEqual({ label: 'T', tone: 'warning' });
    expect(resolveActivityStatus('consulting', '', labels)).toEqual({ label: 'C', tone: 'primary' });
    expect(resolveActivityStatus('ready', '', labels)).toEqual({ label: 'R', tone: 'success' });
  });

  it('shows the speech notice only for a notice activity that has one', () => {
    expect(resolveActivityStatus('notice', 'Sin voz', labels)).toEqual({ label: 'Sin voz', tone: 'warning' });
    expect(resolveActivityStatus('notice', '', labels)).toEqual({ label: 'R', tone: 'success' });
  });

  it('numbers unlabeled audio inputs by position', () => {
    expect(buildAudioInputOptions(
      [{ deviceId: 'a', label: 'Mic A' }, { deviceId: 'b', label: '' }],
      position => `Input ${position}`
    )).toEqual([{ id: 'a', label: 'Mic A' }, { id: 'b', label: 'Input 2' }]);
  });
});
