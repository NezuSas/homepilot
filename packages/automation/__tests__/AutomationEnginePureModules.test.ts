import { DateTime } from 'luxon';
import type { AutomationRule, CompoundTrigger, DeviceStateTrigger, TimeTrigger } from '../../devices/domain/automation/types';
import type { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import { createLoopPreventionKey, projectCommandToState } from '../application/engine/actionPolicy';
import {
  evaluateCompound,
  matchDeviceStateTrigger,
  matchTimeTrigger,
  resolveStateValue,
} from '../application/engine/triggerMatching';

function stateEvent(newState: SystemStateChangeEvent['newState'], deviceId = 'dev-1'): SystemStateChangeEvent {
  return {
    eventId: 'evt-1',
    occurredAt: '2026-01-01T00:00:00.000Z',
    source: 'home_assistant',
    deviceId,
    externalId: 'ha:light.x',
    newState,
  };
}

const onTrigger: DeviceStateTrigger = {
  type: 'device_state_changed',
  deviceId: 'dev-1',
  stateKey: 'state',
  operator: 'equals',
  expectedValue: 'on',
} as DeviceStateTrigger;

describe('actionPolicy', () => {
  it('projects only turn_on and turn_off to a state', () => {
    expect(projectCommandToState('turn_on')).toBe('on');
    expect(projectCommandToState('turn_off')).toBe('off');
    expect(projectCommandToState('toggle')).toBeNull();
  });

  it('builds loop prevention keys from the trigger expectation or compound marker', () => {
    const action = { type: 'device_command', targetDeviceId: 'dev-2', command: 'turn_on' } as const;
    const simple = { id: 'r1', trigger: onTrigger, action } as unknown as AutomationRule;
    const compound = { id: 'r2', trigger: { type: 'compound' }, action } as unknown as AutomationRule;
    expect(createLoopPreventionKey(simple, action)).toBe('r1:dev-2:turn_on:on');
    expect(createLoopPreventionKey(compound, action)).toBe('r2:dev-2:turn_on:compound');
  });
});

describe('triggerMatching', () => {
  it('resolves state keys from state, attributes or the raw object', () => {
    expect(resolveStateValue({ state: 'on' }, 'state')).toBe('on');
    expect(resolveStateValue({ attributes: { brightness: 3 } }, 'brightness')).toBe(3);
    expect(resolveStateValue({ brightness: 4 }, 'brightness')).toBe(4);
    expect(resolveStateValue(null, 'state')).toBeUndefined();
  });

  it('matches device state triggers and ignores other devices or unavailable states', () => {
    expect(matchDeviceStateTrigger(onTrigger, stateEvent({ state: 'on' }))).toBe(true);
    expect(matchDeviceStateTrigger(onTrigger, stateEvent({ state: 'off' }))).toBe(false);
    expect(matchDeviceStateTrigger(onTrigger, stateEvent({ state: 'on' }, 'other'))).toBe(false);
    expect(matchDeviceStateTrigger(onTrigger, stateEvent({ state: 'unavailable' }))).toBe(false);
  });

  it('matches UTC and local time triggers with day filtering', () => {
    const moment = DateTime.fromISO('2026-01-05T12:30:00Z', { zone: 'utc' }); // Monday
    expect(matchTimeTrigger({ type: 'time', timeUTC: '12:30' } as TimeTrigger, moment, 'UTC')).toBe(true);
    expect(matchTimeTrigger({ type: 'time', timeUTC: '12:30', days: [2] } as TimeTrigger, moment, 'UTC')).toBe(false);
    expect(matchTimeTrigger({ type: 'time', timeLocal: '07:30', timezone: 'America/Guayaquil' } as TimeTrigger, moment, 'UTC')).toBe(true);
    expect(matchTimeTrigger({ type: 'time' } as TimeTrigger, moment, 'UTC')).toBe(false);
  });

  it('evaluates AND/OR compound triggers, treating missing context as no match', async () => {
    const timeSub = { type: 'time', timeUTC: '12:30' } as TimeTrigger;
    const and = { type: 'compound', operator: 'AND', conditions: [onTrigger, timeSub] } as CompoundTrigger;
    const or = { type: 'compound', operator: 'OR', conditions: [onTrigger, timeSub] } as CompoundTrigger;
    const event = stateEvent({ state: 'on' });
    expect(await evaluateCompound(and, event, null, null)).toBe(false);
    expect(await evaluateCompound(or, event, null, null)).toBe(true);
    const moment = DateTime.fromISO('2026-01-05T12:30:00Z', { zone: 'utc' });
    expect(await evaluateCompound(and, event, moment, 'UTC')).toBe(true);
  });
});
