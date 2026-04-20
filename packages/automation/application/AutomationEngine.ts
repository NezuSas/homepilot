import { DateTime } from 'luxon';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository, ActivityType } from '../../devices/domain/repositories/ActivityLogRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import {
  AutomationRule,
  AutomationAction,
  DeviceStateTrigger,
  TimeTrigger,
  CompoundTrigger,
} from '../../devices/domain/automation/types';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';

export interface AutomationCommandDispatcher {
  dispatchCommand(homeId: string, deviceId: string, command: string, correlationId: string): Promise<void>;
  executeScene(homeId: string, sceneId: string, correlationId: string): Promise<void>;
}

export interface IdGenerator {
  generate(): string;
}

export interface AutomationEngineObservableState {
  status: 'idle' | 'active' | 'error';
  lastExecutionAt: string | null;
  totalSuccesses: number;
  totalFailures: number;
}

/**
 * AutomationEngine — The core "Brain" of HomePilot Edge.
 * Orchestrates event-driven and time-driven automations.
 */
export class AutomationEngine {
  private lastExecutionAt: string | null = null;
  private totalSuccesses = 0;
  private totalFailures = 0;
  private lastStatus: 'idle' | 'active' | 'error' = 'idle';

  // Loop prevention: ruleId -> timestamp
  private loopPreventionCache = new Map<string, number>();
  private readonly DEDUPLICATION_WINDOW_MS = 2000;

  // Time-guard: ruleId -> YYYY-MM-DD-HH-mm (Ensures time triggers fire only once per scheduled slot)
  private timeFireGuard = new Map<string, string>();

  constructor(
    private readonly ruleRepository: AutomationRuleRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly sceneRepository: SceneRepository,
    private readonly commandDispatcher: AutomationCommandDispatcher,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly systemVariableService: SystemVariableService,
    private readonly idGenerator: IdGenerator
  ) {}

  /**
   * Main entry point for state changes (Event-driven).
   */
  public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void> {
    const rules = await this.ruleRepository.findAll();
    const correlationId = `auto-evt-${Date.now()}`;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      if (rule.trigger.type === 'device_state_changed') {
        const trigger = rule.trigger as DeviceStateTrigger;
        if (this.matchDeviceStateTrigger(trigger, event)) {
          await this.fireRule(rule, correlationId);
        }
      } else if (rule.trigger.type === 'compound') {
        const trigger = rule.trigger as CompoundTrigger;
        if (await this.evaluateCompound(trigger, event, null, null)) {
          await this.fireRule(rule, correlationId);
        }
      }
    }
  }

  /**
   * Periodic tick for time-scheduled rules (Time-driven).
   */
  public async handleTimeEvent(pulseTimeUTC: string, referenceDate?: Date): Promise<void> {
    const rules = await this.ruleRepository.findAll();
    const systemTimezone = await this.systemVariableService.getSystemTimezone();
    
    // Construct the deterministic UTC moment of the pulse
    const anchor = referenceDate || new Date();
    const baseMoment = DateTime.fromFormat(pulseTimeUTC, 'HH:mm', { zone: 'utc' })
      .set({
        year: anchor.getUTCFullYear(),
        month: anchor.getUTCMonth() + 1,
        day: anchor.getUTCDate()
      });

    const todayPrefix = anchor.toISOString().split('T')[0];
    const timeSlotKey = `${todayPrefix}-${pulseTimeUTC}`;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      if (rule.trigger.type === 'time') {
        const trigger = rule.trigger as TimeTrigger;

        // Ensure we haven't already fired this specific time slot for this rule
        if (this.timeFireGuard.get(rule.id) === timeSlotKey) continue;

        if (this.matchTimeTrigger(trigger, baseMoment, systemTimezone)) {
          this.timeFireGuard.set(rule.id, timeSlotKey);
          await this.fireRule(rule, `auto-time-${this.idGenerator.generate()}`);
        }
      }
    }

    this.cleanCache();
  }

  // ─── Trigger Matching ────────────────────────────────────────────────────────

  private async evaluateCompound(
    trigger: CompoundTrigger,
    event: SystemStateChangeEvent | null,
    baseMoment: DateTime | null,
    systemTimezone: string | null
  ): Promise<boolean> {
    const { operator, conditions } = trigger;

    const evalFn = async (sub: any): Promise<boolean> => {
      if (sub.type === 'device_state_changed') {
        if (!event) return false;
        return this.matchDeviceStateTrigger(sub as DeviceStateTrigger, event);
      }
      if (sub.type === 'time') {
        if (baseMoment === null || systemTimezone === null) return false;
        return this.matchTimeTrigger(sub as TimeTrigger, baseMoment, systemTimezone);
      }
      if (sub.type === 'compound') {
        return this.evaluateCompound(sub as CompoundTrigger, event, baseMoment, systemTimezone);
      }
      return false;
    };

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
    baseMoment: DateTime,
    systemTimezone: string
  ): boolean {
    const luxonToRuleDay = (lx: number): number => (lx === 7 ? 0 : lx);

    // STRATEGY 1: Local Rule (timeLocal + timezone)
    if (trigger.timeLocal) {
      const targetTz = trigger.timezone || systemTimezone;
      const localMoment = baseMoment.setZone(targetTz);
      
      const timeMatches = localMoment.toFormat('HH:mm') === trigger.timeLocal;
      const localDay = luxonToRuleDay(localMoment.weekday);
      const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(localDay);
      
      return timeMatches && dayMatches;
    }

    // STRATEGY 2: UTC Rule (timeUTC)
    if (trigger.timeUTC) {
      const timeMatches = baseMoment.toFormat('HH:mm') === trigger.timeUTC;
      const utcDay = luxonToRuleDay(baseMoment.weekday);
      const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(utcDay);
      
      return timeMatches && dayMatches;
    }

    // STRATEGY 3: Legacy/Fallthrough Rule (deprecated time field)
    if (trigger.time) {
      const localMoment = baseMoment.setZone(systemTimezone);
      const timeMatches = localMoment.toFormat('HH:mm') === trigger.time;
      const localDay = luxonToRuleDay(localMoment.weekday);
      const dayMatches = !trigger.days || trigger.days.length === 0 || trigger.days.includes(localDay);
      
      return timeMatches && dayMatches;
    }

    return false;
  }

  private resolveStateValue(
    state: Record<string, unknown> | null | undefined,
    stateKey: string
  ): unknown {
    if (!state) return undefined;
    if (stateKey === 'state') return state.state ?? state['state'];
    if (state.attributes && typeof state.attributes === 'object') {
      return (state.attributes as Record<string, unknown>)[stateKey];
    }
    return state[stateKey];
  }

  // ─── Rule execution ───────────────────────────────────────────────────────────

  private async fireRule(rule: AutomationRule, correlationId: string): Promise<void> {
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
        const lastState = targetDevice.lastKnownState as Record<string, unknown> | null;
        if (projected !== null && lastState?.state === projected) {
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
          type: 'COMMAND_DISPATCHED',
          description: `Triggered by Automation: ${rule.name}`,
          correlationId,
          data: { ruleId: rule.id, ruleName: rule.name, command: action.command }
        });
        this.totalSuccesses++;
        this.lastExecutionAt = new Date().toISOString();
        this.lastStatus = 'active';
        return;
      }

      if (action.type === 'execute_scene') {
        await this.commandDispatcher.executeScene(rule.homeId, action.sceneId, correlationId);
        this.totalSuccesses++;
        return;
      }
    } catch (error: any) {
      const dispatchError = error instanceof Error ? error : new Error(String(error));
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
        type: (status === 'error' ? 'AUTOMATION_FAILED' : 'AUTOMATION_EXECUTED') as ActivityType,
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
