import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import {
  ObservableAutomationEngineStateProvider,
  AutomationEngineObservableState,
} from '../../system-observability/domain/ObservableStateProviders';
import {
  AutomationRule,
  AutomationTrigger,
  AutomationAction,
  DeviceStateTrigger,
  TimeTrigger,
  CompoundTrigger,
  DelayAction,
} from '../../devices/domain/automation/types';
import { DateTime } from 'luxon';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';

/**
 * Simple dispatch port used by the engine to execute commands and scenes.
 */
export interface AutomationCommandDispatcher {
  dispatchCommand(
    homeId: string,
    deviceId: string,
    command: string,
    correlationId: string
  ): Promise<void>;
  executeScene(homeId: string, sceneId: string, correlationId: string): Promise<void>;
}

export class AutomationEngine implements ObservableAutomationEngineStateProvider {
  // In-memory deduplication window (2 000 ms) to prevent echo loops.
  private readonly loopPreventionCache = new Map<string, number>();
  private readonly DEDUPLICATION_WINDOW_MS = 2000;

  // Guard to prevent time-rules firing more than once per UTC minute boundary.
  // key: ruleId, value: last-fired "YYYY-MM-DD HH:mm"
  private readonly timeFireGuard = new Map<string, string>();

  // ─── Observability State ─────────────────────────────────────────────────────
  private lastExecutionAt: string | null = null;
  private totalSuccesses: number = 0;
  private totalFailures: number = 0;
  private lastStatus: 'active' | 'idle' | 'error' = 'idle';

  constructor(
    private readonly ruleRepository: AutomationRuleRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly commandDispatcher: AutomationCommandDispatcher,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly systemVariableService: SystemVariableService,
    private readonly idGenerator: { generate: () => string }
  ) {
    // Periodic leak prevention for deduplication and time-guard caches.
    setInterval(() => this.cleanCache(), 60_000).unref();
  }

  // ─── Public handlers ─────────────────────────────────────────────────────────

  /**
   * Process a device state-change event.
   * Evaluates all enabled rules whose trigger (directly or via compound logic)
   * references the changed device.
   */
  public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void> {
    try {
      const allRules = await this.ruleRepository.findAll();
      const candidates = allRules.filter(
        (r) => r.enabled && this.triggerReferencesDevice(r.trigger, event.deviceId)
      );

      for (const rule of candidates) {
        try {
          const matches = await this.evaluateTriggerForDeviceEvent(rule.trigger, event);
          if (matches) {
            await this.fireRule(rule, event.eventId);
          }
        } catch (ruleError: any) {
          console.error(
            `[AutomationEngine] Error isolating rule ${rule.id} (correlationId: ${event.eventId}):`,
            ruleError.message
          );
        }
      }
    } catch (globalError: any) {
      this.lastStatus = 'error';
      console.error('[AutomationEngine] Fatal error processing system event:', globalError.message);
    }
  }

  /**
   * Process a UTC minute boundary tick.
   * @param currentTime "HH:mm" always in UTC.
   */
  public async handleTimeEvent(currentTimeUTC: string): Promise<void> {
    try {
      const allRules = await this.ruleRepository.findAll();
      const timeRules = allRules.filter(
        (r) => r.enabled && this.triggerContainsTimeTrigger(r.trigger)
      );

      // Resolve effective local time for the appliance based on system settings.
      const systemTimezone = await this.systemVariableService.getSystemTimezone();
      const nowLocal = DateTime.now().setZone(systemTimezone);
      const currentTimeLocal = nowLocal.toFormat('HH:mm');
      const currentDayLocal = nowLocal.weekday === 7 ? 0 : nowLocal.weekday; // match JS getDay() 0=Sun

      console.log(`[AutomationEngine] Tick: EngineLocalTime=${currentTimeLocal} (Zone=${systemTimezone}) RulesToEval=${timeRules.length}`);

      for (const rule of timeRules) {
        try {
          const matches = await this.evaluateTriggerForTimeEvent(
            rule.trigger,
            currentTimeLocal,
            currentDayLocal
          );
          if (!matches) continue;

          // Once-per-minute guard (strictly tied to Date + HH:mm in local context)
          const dateStr = nowLocal.toISODate();
          const fireKey = `${dateStr} ${currentTimeLocal}`;

          if (this.timeFireGuard.get(rule.id) === fireKey) continue;
          this.timeFireGuard.set(rule.id, fireKey);

          const correlationId = this.idGenerator.generate();
          await this.fireRule(rule, correlationId);
        } catch (ruleError: any) {
          console.error(
            `[AutomationEngine] Error executing time rule ${rule.id}:`,
            ruleError.message
          );
        }
      }
    } catch (globalError: any) {
      console.error('[AutomationEngine] Fatal error processing time event:', globalError.message);
    }
  }

  // ─── Trigger evaluation ───────────────────────────────────────────────────────

  /**
   * Returns true if the trigger (or any sub-trigger) references deviceId.
   * Used to quickly filter which rules are relevant for a given state-change event.
   */
  private triggerReferencesDevice(trigger: AutomationTrigger, deviceId: string): boolean {
    if (trigger.type === 'device_state_changed') return trigger.deviceId === deviceId;
    if (trigger.type === 'compound') {
      return trigger.conditions.some((c) => this.triggerReferencesDevice(c, deviceId));
    }
    return false;
  }

  /**
   * Returns true if the trigger contains at least one TimeTrigger.
   * Used to filter rules relevant for a time event.
   */
  private triggerContainsTimeTrigger(trigger: AutomationTrigger): boolean {
    if (trigger.type === 'time') return true;
    if (trigger.type === 'compound') {
      return trigger.conditions.some((c) => this.triggerContainsTimeTrigger(c));
    }
    return false;
  }

  /**
   * Evaluate a trigger against a device state-change event.
   * For CompoundTrigger: TimeTrigger sub-conditions always return false
   * (time is evaluated separately in handleTimeEvent).
   */
  private async evaluateTriggerForDeviceEvent(
    trigger: AutomationTrigger,
    event: SystemStateChangeEvent
  ): Promise<boolean> {
    if (trigger.type === 'time') return false;

    if (trigger.type === 'device_state_changed') {
      return this.matchDeviceStateTrigger(trigger, event);
    }

    if (trigger.type === 'compound') {
      return this.evaluateCompound(trigger, (sub) =>
        this.evaluateTriggerForDeviceEvent(sub, event)
      );
    }

    return false;
  }

  /**
   * Evaluate a trigger against the current time.
   * For CompoundTrigger: DeviceStateTrigger sub-conditions are evaluated
   * against current device state from the repository.
   */
  private async evaluateTriggerForTimeEvent(
    trigger: AutomationTrigger,
    currentTimeLocal: string,
    currentDay: number
  ): Promise<boolean> {
    if (trigger.type === 'device_state_changed') {
      // Fetch current state from repository
      const device = await this.deviceRepository.findDeviceById(trigger.deviceId);
      if (!device) return false;

      const currentValue = this.resolveStateValue(device.lastKnownState, trigger.stateKey);
      return String(currentValue) === String(trigger.expectedValue);
    }

    if (trigger.type === 'time') {
      return this.matchTimeTrigger(trigger, currentTimeLocal, currentDay);
    }

    if (trigger.type === 'compound') {
      return this.evaluateCompound(trigger, (sub) =>
        this.evaluateTriggerForTimeEvent(sub, currentTimeLocal, currentDay)
      );
    }

    return false;
  }

  /**
   * Evaluate a CompoundTrigger by applying its operator over all sub-conditions.
   */
  private async evaluateCompound(
    trigger: CompoundTrigger,
    evalFn: (sub: AutomationTrigger) => Promise<boolean>
  ): Promise<boolean> {
    const { operator, conditions } = trigger;

    if (operator === 'NOT') {
      if (conditions.length === 0) return false;
      return !(await evalFn(conditions[0]));
    }

    if (operator === 'AND') {
      for (const sub of conditions) {
        if (!(await evalFn(sub))) return false;
      }
      return true;
    }

    // OR
    for (const sub of conditions) {
      if (await evalFn(sub)) return true;
    }
    return false;
  }

  private matchDeviceStateTrigger(
    trigger: DeviceStateTrigger,
    event: SystemStateChangeEvent
  ): boolean {
    if (trigger.deviceId !== event.deviceId) return false;

    const currentValue = this.resolveStateValue(
      event.newState as Record<string, unknown>,
      trigger.stateKey
    );
    return String(currentValue) === String(trigger.expectedValue);
  }

  private matchTimeTrigger(
    trigger: TimeTrigger,
    currentTimeLocal: string,
    currentDay: number
  ): boolean {
    const targetTime = trigger.timeLocal || trigger.time || trigger.timeUTC;
    if (targetTime !== currentTimeLocal) return false;
    if (trigger.days && trigger.days.length > 0 && !trigger.days.includes(currentDay)) {
      return false;
    }
    return true;
  }

  private resolveStateValue(
    state: Record<string, unknown> | null | undefined,
    stateKey: string
  ): unknown {
    if (!state) return undefined;
    if (stateKey === 'state') return (state as any).state ?? state['state'];
    if (state.attributes && typeof state.attributes === 'object') {
      return (state.attributes as Record<string, unknown>)[stateKey];
    }
    return state[stateKey];
  }

  // ─── Rule execution ───────────────────────────────────────────────────────────

  /**
   * Fire a rule after the trigger condition has been confirmed.
   * Applies deduplication to prevent rapid re-fires within DEDUPLICATION_WINDOW_MS.
   */
  private async fireRule(rule: AutomationRule, correlationId: string): Promise<void> {
    // Deduplication signature: ruleId to prevent event echo within 2 s
    const cacheKey = rule.id;
    const now = Date.now();
    const lastExecution = this.loopPreventionCache.get(cacheKey);

    if (lastExecution !== undefined && now - lastExecution < this.DEDUPLICATION_WINDOW_MS) {
      return;
    }
    this.loopPreventionCache.set(cacheKey, now);

    await this.executeRuleAction(rule, rule.action, correlationId);
  }

  private async executeRuleAction(
    rule: AutomationRule,
    action: AutomationAction,
    correlationId: string
  ): Promise<void> {
    try {
      if (action.type === 'device_command') {
        const targetDevice = await this.deviceRepository.findDeviceById(action.targetDeviceId);
        if (!targetDevice) throw new Error(`Target device ${action.targetDeviceId} not found.`);

        // Skip if device is already in the desired state (turn_on/off only)
        const projected = this.projectCommandToState(action.command);
        if (projected !== null && (targetDevice.lastKnownState as any)?.state === projected) {
          return;
        }

        await this.commandDispatcher.dispatchCommand(
          targetDevice.homeId,
          action.targetDeviceId,
          action.command,
          correlationId
        );
        await this.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: action.targetDeviceId,
          type: 'COMMAND_DISPATCHED' as any,
          description: `Triggered by Automation: ${rule.name}`,
          correlationId,
          data: { ruleId: rule.id, ruleName: rule.name, command: action.command }
        });
        this.totalSuccesses++;
        this.lastExecutionAt = new Date().toISOString();
        this.lastStatus = 'active';
        return;
      } else if (action.type === 'execute_scene') {
        const scene = await this.sceneRepository.findSceneById(action.sceneId);
        if (!scene) throw new Error(`Scene ${action.sceneId} not found.`);

        await this.commandDispatcher.executeScene(scene.homeId, action.sceneId, correlationId);
      } else if (action.type === 'delay') {
        // Schedule the nested action after delaySeconds.
        // NOTE: Delay is in-memory (setTimeout). Pending delays are lost on restart.
        const delayMs = (action as DelayAction).delaySeconds * 1000;
        const nestedAction = (action as DelayAction).then;

        setTimeout(() => {
          this.executeRuleAction(rule, nestedAction, correlationId).catch((err) => {
            console.error(
              `[AutomationEngine] Delayed action for rule ${rule.id} failed:`,
              err.message
            );
          });
        }, delayMs).unref();

        // Treat scheduling itself as success
        this.totalSuccesses++;
        this.lastExecutionAt = new Date().toISOString();
        this.lastStatus = 'active';
        await this.logExecution(rule, correlationId, 'success', `Delay action scheduled (${(action as DelayAction).delaySeconds}s).`);
        return;
      }

      this.totalSuccesses++;
      this.lastExecutionAt = new Date().toISOString();
      this.lastStatus = 'active';
      await this.logExecution(rule, correlationId, 'success', 'Automation executed successfully.');
    } catch (dispatchError: any) {
      this.totalFailures++;
      this.lastExecutionAt = new Date().toISOString();
      this.lastStatus = 'error';
      await this.logExecution(
        rule,
        correlationId,
        'error',
        `Automation failed: ${dispatchError.message}`,
        action.type === 'device_command' ? action.targetDeviceId : undefined
      );
      throw dispatchError;
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private projectCommandToState(command: string): string | null {
    if (command === 'turn_on') return 'on';
    if (command === 'turn_off') return 'off';
    return null;
  }

  private async logExecution(
    rule: AutomationRule,
    correlationId: string,
    status: 'success' | 'error',
    reason: string,
    deviceId: string | null = null
  ): Promise<void> {
    try {
      await this.activityLogRepository.saveActivity({
        timestamp: new Date().toISOString(),
        deviceId,
        type: (status === 'error' ? 'AUTOMATION_FAILED' : 'AUTOMATION_EXECUTED') as any,
        description: `Automation "${rule.name}" ${status === 'error' ? 'failed' : 'executed successfully'}.`,
        correlationId,
        data: {
          ruleId: rule.id,
          ruleName: rule.name,
          trigger: rule.trigger,
          action: rule.action,
          status: status === 'error' ? 'failed' : 'executed',
          reason: status === 'error' ? reason : undefined,
        },
      });
    } catch {
      // Logging failures must not block the automation pipeline.
    }
  }

  private cleanCache(): void {
    const expired = Date.now() - this.DEDUPLICATION_WINDOW_MS;
    for (const [key, timestamp] of this.loopPreventionCache.entries()) {
      if (timestamp < expired) this.loopPreventionCache.delete(key);
    }

    // Remove time-guard entries from previous days.
    const todayPrefix = new Date().toISOString().split('T')[0];
    for (const [ruleId, lastFiredKey] of this.timeFireGuard.entries()) {
      if (!lastFiredKey.startsWith(todayPrefix)) this.timeFireGuard.delete(ruleId);
    }
  }

  // ─── Observable State Provider ────────────────────────────────────────────────

  public getObservableState(): AutomationEngineObservableState {
    let currentStatus = this.lastStatus;
    if (currentStatus === 'active' && this.lastExecutionAt) {
      const msSinceLast = Date.now() - new Date(this.lastExecutionAt).getTime();
      if (msSinceLast > 5 * 60 * 1000) currentStatus = 'idle';
    }

    return {
      status: currentStatus,
      lastExecutionAt: this.lastExecutionAt,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
    };
  }
}
