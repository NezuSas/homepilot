import { DateTime } from 'luxon';
import { getActiveTimers, getErrorMessage, type AutomationRule } from './automationsModel';

const timerRule = (id: string, overrides: Partial<AutomationRule['trigger']> = {}, enabled = true): AutomationRule => ({
  id,
  name: id,
  enabled,
  trigger: { type: 'time', dateLocal: '2030-01-01', timeLocal: '10:00', timezone: 'UTC', ...overrides },
  action: { type: 'execute_scene', sceneId: 's' },
});

const reference = DateTime.fromISO('2030-01-01T09:00:00', { zone: 'UTC' });

describe('automations view model', () => {
  it('lists pending one-shot timers soonest first with rounded-up minutes', () => {
    const timers = getActiveTimers([
      timerRule('later', { timeLocal: '11:30' }),
      timerRule('soon', { timeLocal: '09:01' }),
    ], reference);
    expect(timers.map((timer) => [timer.rule.id, timer.remainingMinutes])).toEqual([['soon', 1], ['later', 150]]);
  });

  it('skips disabled, past, recurring and non-time rules', () => {
    const timers = getActiveTimers([
      timerRule('disabled', {}, false),
      timerRule('past', { timeLocal: '08:00' }),
      timerRule('recurring', { dateLocal: undefined }),
      timerRule('device', { type: 'device_state_changed' }),
    ], reference);
    expect(timers).toEqual([]);
  });

  it('falls back when the error is not an Error instance', () => {
    expect(getErrorMessage(new Error('boom'), 'fallback')).toBe('boom');
    expect(getErrorMessage('boom', 'fallback')).toBe('fallback');
  });
});
