import { AutomationEngine, AutomationCommandDispatcher, IdGenerator } from '../application/AutomationEngine';
import { AutomationRule } from '../../devices/domain/automation/types';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';
import { Device } from '../../devices/domain/types';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

const createRule = (overrides: Partial<AutomationRule> = {}): AutomationRule => ({
  id: 'automation-1',
  homeId: 'home-1',
  userId: 'user-1',
  name: 'Turn on target',
  enabled: true,
  trigger: {
    type: 'device_state_changed',
    deviceId: 'source-device',
    stateKey: 'state',
    expectedValue: 'on',
  },
  action: {
    type: 'device_command',
    targetDeviceId: 'target-device',
    command: 'turn_on',
  },
  ...overrides,
});

const createDevice = (overrides: Partial<Device> = {}): Device => ({
  id: 'target-device',
  homeId: 'home-1',
  roomId: 'room-1',
  externalId: 'ha:light.target',
  name: 'Target light',
  type: 'light',
  vendor: 'Home Assistant',
  status: 'ASSIGNED',
  integrationSource: 'ha',
  invertState: false,
  lastKnownState: { state: 'off' },
  entityVersion: 1,
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
  ...overrides,
});

const matchingEvent = (): SystemStateChangeEvent => ({
  eventId: 'event-1',
  occurredAt: '2026-08-16T12:00:00.000Z',
  source: 'home_assistant',
  deviceId: 'source-device',
  externalId: 'ha:light.source',
  previousState: { state: 'off' },
  newState: { state: 'on' },
});

function createHarness(rules: ReadonlyArray<AutomationRule>, targetDevice: Device | null = createDevice()) {
  const ruleRepository = {
    findAll: jest.fn().mockResolvedValue(rules),
    findById: jest.fn().mockImplementation((id: string) => Promise.resolve(rules.find((rule) => rule.id === id) ?? null)),
    delete: jest.fn().mockResolvedValue(undefined),
  } as unknown as AutomationRuleRepository;
  const deviceRepository = {
    findDeviceById: jest.fn().mockResolvedValue(targetDevice),
  } as unknown as DeviceRepository;
  const dispatcher: jest.Mocked<AutomationCommandDispatcher> = {
    dispatchCommand: jest.fn().mockResolvedValue(undefined),
    executeScene: jest.fn().mockResolvedValue(undefined),
  };
  const activityLogRepository = {
    saveActivity: jest.fn().mockResolvedValue(undefined),
  } as unknown as ActivityLogRepository;
  const systemVariableService = {
    getSystemTimezone: jest.fn().mockResolvedValue('UTC'),
  } as unknown as SystemVariableService;
  const idGenerator: IdGenerator = { generate: jest.fn().mockReturnValue('time-1') };
  return {
    engine: new AutomationEngine(ruleRepository, deviceRepository, dispatcher, activityLogRepository, systemVariableService, idGenerator),
    deviceRepository,
    dispatcher,
    activityLogRepository,
    ruleRepository,  };
}

describe('Feature: automation rule execution', () => {
  it('dispatches a matching device-state rule and records a successful execution', async () => {
    const harness = createHarness([createRule()]);

    await harness.engine.handleSystemEvent(matchingEvent());

    expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledWith(
      'home-1', 'target-device', 'turn_on', expect.stringMatching(/^auto-evt-/), 'automation-1',
    );
    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: 'target-device',
      type: 'COMMAND_DISPATCHED',
    }));
    expect(harness.engine.getObservableState()).toEqual(expect.objectContaining({
      status: 'active',
      totalSuccesses: 1,
      totalFailures: 0,
    }));
  });

  it('records unmatched rules without dispatching a command', async () => {
    const harness = createHarness([createRule({
      trigger: {
        type: 'device_state_changed',
        deviceId: 'source-device',
        stateKey: 'state',
        expectedValue: 'off',
      },
    })]);

    await harness.engine.handleSystemEvent(matchingEvent());

    expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AUTOMATION_EXECUTED',
      data: expect.objectContaining({ status: 'skipped_no_match' }),
    }));
  });

  it('does not dispatch an idempotent command when its target already has the desired state', async () => {
    const harness = createHarness([createRule()], createDevice({ lastKnownState: { state: 'on' } }));

    await harness.engine.handleSystemEvent(matchingEvent());

    expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'skipped_target_state_match' }),
    }));
  });

  it('fires a scheduled scene only once for the same deterministic time slot', async () => {
    const scheduledRule = createRule({
      id: 'scene-rule',
      trigger: {
        type: 'time',
        timeLocal: '12:00',
        timezone: 'UTC',
        timeUTC: '12:00',
        days: [0],
      },
      action: { type: 'execute_scene', sceneId: 'scene-1' },
    });
    jest.useFakeTimers().setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    try {
      const harness = createHarness([scheduledRule]);
      const sunday = new Date('2026-08-16T12:00:00.000Z');

      await harness.engine.handleTimeEvent('12:00', sunday);
      await harness.engine.handleTimeEvent('12:00', sunday);

      expect(harness.dispatcher.executeScene).toHaveBeenCalledTimes(1);
      expect(harness.dispatcher.executeScene).toHaveBeenCalledWith('home-1', 'scene-1', 'auto-time-time-1', 'scene-rule');
    } finally {
      jest.useRealTimers();
    }
  });

  it('executes and removes a date-restricted time rule only on its configured local date', async () => {
    const timerRule = createRule({
      id: 'timer-rule',
      trigger: { type: 'time', timeLocal: '12:00', timezone: 'UTC', timeUTC: '12:00', dateLocal: '2026-08-16' },
      action: { type: 'execute_scene', sceneId: 'scene-timer' },
    });
    const harness = createHarness([timerRule]);

    await harness.engine.handleTimeEvent('12:00', new Date('2026-08-15T12:00:00.000Z'));
    await harness.engine.handleTimeEvent('12:00', new Date('2026-08-16T12:00:00.000Z'));

    expect(harness.dispatcher.executeScene).toHaveBeenCalledTimes(1);
    expect((harness.ruleRepository as unknown as { delete: jest.Mock }).delete).toHaveBeenCalledWith('timer-rule');
  });
  it('reports a failed dispatch without letting one rule break the automation pipeline', async () => {
    const harness = createHarness([createRule()]);
    harness.dispatcher.dispatchCommand.mockRejectedValueOnce(new Error('transport unavailable'));

    await expect(harness.engine.handleSystemEvent(matchingEvent())).resolves.toBeUndefined();

    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      type: 'AUTOMATION_FAILED',
      data: expect.objectContaining({ status: 'failed' }),
    }));
    expect(harness.engine.getObservableState()).toEqual(expect.objectContaining({
      status: 'error',
      totalFailures: 1,
    }));
  });
  it('ignores disabled rules without dispatching or producing activity', async () => {
    const harness = createHarness([createRule({ enabled: false })]);

    await harness.engine.handleSystemEvent(matchingEvent());

    expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
    expect(harness.activityLogRepository.saveActivity).not.toHaveBeenCalled();
  });

  it('prevents a repeated matching event from immediately redispatching the same action', async () => {
    const harness = createHarness([createRule()]);

    await harness.engine.handleSystemEvent(matchingEvent());
    await harness.engine.handleSystemEvent({ ...matchingEvent(), eventId: 'event-2' });

    expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledTimes(1);
    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'skipped_loop_prevention', eventId: 'event-2' }),
    }));
  });

  it('evaluates compound rules with matching OR conditions and skips unmatched AND conditions', async () => {
    const matchingRule = createRule({
      id: 'or-rule',
      trigger: {
        type: 'compound',
        operator: 'OR',
        conditions: [
          { type: 'device_state_changed', deviceId: 'other-device', stateKey: 'state', expectedValue: 'on' },
          { type: 'device_state_changed', deviceId: 'source-device', stateKey: 'state', expectedValue: 'on' },
        ],
      },
    });
    const unmatchedRule = createRule({
      id: 'and-rule',
      trigger: {
        type: 'compound',
        operator: 'AND',
        conditions: [
          { type: 'device_state_changed', deviceId: 'source-device', stateKey: 'state', expectedValue: 'on' },
          { type: 'device_state_changed', deviceId: 'other-device', stateKey: 'state', expectedValue: 'on' },
        ],
      },
    });
    const harness = createHarness([matchingRule, unmatchedRule]);

    await harness.engine.handleSystemEvent(matchingEvent());

    expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledTimes(1);
    expect(harness.activityLogRepository.saveActivity).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ruleId: 'and-rule', status: 'skipped_no_match' }),
    }));
  });

  it('supports UTC and legacy scheduled rules while respecting their configured days', async () => {
    const utcRule = createRule({
      id: 'utc-rule',
      trigger: { type: 'time', timeLocal: '', timezone: '', timeUTC: '12:00', days: [0] },
      action: { type: 'execute_scene', sceneId: 'scene-utc' },
    });
    const legacyRule = createRule({
      id: 'legacy-rule',
      trigger: { type: 'time', timeLocal: '', timezone: '', timeUTC: '', time: '12:00', days: [] },
      action: { type: 'execute_scene', sceneId: 'scene-legacy' },
    });
    const wrongDayRule = createRule({
      id: 'wrong-day-rule',
      trigger: { type: 'time', timeLocal: '', timezone: '', timeUTC: '12:00', days: [1] },
      action: { type: 'execute_scene', sceneId: 'scene-never' },
    });
    const harness = createHarness([utcRule, legacyRule, wrongDayRule]);

    await harness.engine.handleTimeEvent('12:00', new Date('2026-08-16T12:00:00.000Z'));

    expect(harness.dispatcher.executeScene).toHaveBeenCalledTimes(2);
    expect(harness.dispatcher.executeScene).toHaveBeenCalledWith('home-1', 'scene-utc', 'auto-time-time-1', 'utc-rule');
    expect(harness.dispatcher.executeScene).toHaveBeenCalledWith('home-1', 'scene-legacy', 'auto-time-time-1', 'legacy-rule');
  });

  it('captures missing target and scene failures as observable automation errors', async () => {
    const missingTarget = createHarness([createRule()], null);
    await missingTarget.engine.handleSystemEvent(matchingEvent());
    expect(missingTarget.dispatcher.dispatchCommand).not.toHaveBeenCalled();
    expect(missingTarget.engine.getObservableState()).toEqual(expect.objectContaining({
      status: 'error',
      totalFailures: 1,
    }));

    const sceneRule = createRule({
      trigger: { type: 'time', timeLocal: '', timezone: '', timeUTC: '12:00' },
      action: { type: 'execute_scene', sceneId: 'scene-failure' },
    });
    const sceneHarness = createHarness([sceneRule]);
    sceneHarness.dispatcher.executeScene.mockRejectedValueOnce('scene transport unavailable');

    await sceneHarness.engine.handleTimeEvent('12:00', new Date('2026-08-16T12:00:00.000Z'));

    expect(sceneHarness.engine.getObservableState()).toEqual(expect.objectContaining({
      status: 'error',
      totalFailures: 1,
    }));
  });

  it('matches attribute state values and returns idle after a stale success', async () => {
    const harness = createHarness([createRule({
      trigger: {
        type: 'device_state_changed',
        deviceId: 'source-device',
        stateKey: 'brightness',
        expectedValue: 42,
      },
    })]);
    const event = { ...matchingEvent(), newState: { attributes: { brightness: 42 } } };

    await harness.engine.handleSystemEvent(event);
    jest.useFakeTimers().setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
    try {
      expect(harness.engine.getObservableState()).toEqual(expect.objectContaining({ status: 'idle', totalSuccesses: 1 }));
    } finally {
      jest.useRealTimers();
    }
  });
  it('continues when audit persistence fails and removes expired internal guard entries', async () => {
    const harness = createHarness([createRule()]);
    (harness.activityLogRepository.saveActivity as jest.Mock).mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(harness.engine.handleSystemEvent(matchingEvent())).resolves.toBeUndefined();
    expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledTimes(1);

    const internals = harness.engine as unknown as {
      loopPreventionCache: Map<string, number>;
      timeFireGuard: Map<string, string>;
      cleanCache(): void;
    };
    internals.loopPreventionCache.set('expired', Date.now() - 3_000);
    internals.timeFireGuard.set('old-rule', '2000-01-01-12:00');
    internals.cleanCache();
    expect(internals.loopPreventionCache.has('expired')).toBe(false);
    expect(internals.timeFireGuard.has('old-rule')).toBe(false);
  });
  it('reports an idle observable state after an active execution becomes stale', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-16T12:00:00.000Z'));
    try {
      const harness = createHarness([createRule()]);
      await harness.engine.handleSystemEvent(matchingEvent());

      jest.setSystemTime(new Date('2026-08-16T12:05:01.000Z'));

      expect(harness.engine.getObservableState()).toEqual(expect.objectContaining({
        status: 'idle',
        totalSuccesses: 1,
        totalFailures: 0,
      }));
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Feature: manual "run now" execution (dashboard routine action cards)', () => {
  it('runs a rule immediately, bypassing its trigger and the loop-prevention cache', async () => {
    const harness = createHarness([createRule()]);
    const internals = harness.engine as unknown as { loopPreventionCache: Map<string, number> };
    internals.loopPreventionCache.set('automation-1:target-device:turn_on', Date.now());

    const result = await harness.engine.runRuleNow('automation-1', 'manual-1');

    expect(result).toEqual({ success: true });
    expect(harness.dispatcher.dispatchCommand).toHaveBeenCalledWith(
      'home-1', 'target-device', 'turn_on', 'manual-1', 'automation-1',
    );
  });

  it('returns a not-found error for an unknown rule id', async () => {
    const harness = createHarness([createRule()]);

    const result = await harness.engine.runRuleNow('missing-rule', 'manual-1');

    expect(result).toEqual({ success: false, error: 'AUTOMATION_NOT_FOUND' });
    expect(harness.dispatcher.dispatchCommand).not.toHaveBeenCalled();
  });

  it('surfaces a failure when the dispatched command throws', async () => {
    const harness = createHarness([createRule()]);
    harness.dispatcher.dispatchCommand.mockRejectedValueOnce(new Error('device offline'));

    const result = await harness.engine.runRuleNow('automation-1', 'manual-1');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Turn on target');
  });
});