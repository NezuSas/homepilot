import { DateTime } from 'luxon';
import { canAccessRoutine } from '../../devices/domain/routineAccess';
import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import type { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import {
  AutomationRule,
  AutomationAction,
  DeviceStateTrigger,
  TimeTrigger,
  CompoundTrigger,
} from '../../devices/domain/automation/types';
import { SystemVariableService } from '../../system-vars/application/SystemVariableService';
import { evaluateCompound, matchDeviceStateTrigger, matchTimeTrigger } from './engine/triggerMatching';
import { createLoopPreventionKey, projectCommandToState } from './engine/actionPolicy';
import { AutomationActivityLogger } from './engine/AutomationActivityLogger';

export interface AutomationCommandDispatcher {
  dispatchCommand(homeId: string, deviceId: string, command: string, correlationId: string, ruleId: string): Promise<void>;
  executeScene(homeId: string, sceneId: string, correlationId: string, ruleId: string): Promise<void>;
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

  private readonly activityLogger: AutomationActivityLogger;

  constructor(
    private readonly ruleRepository: AutomationRuleRepository,
    private readonly sceneRepository: Pick<SceneRepository, 'findSceneById' | 'deleteScene'>,
    private readonly deviceRepository: DeviceRepository,
    private readonly commandDispatcher: AutomationCommandDispatcher,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly systemVariableService: SystemVariableService,
    private readonly idGenerator: IdGenerator
  ) {
    this.activityLogger = new AutomationActivityLogger(activityLogRepository);
  }

  /**
   * Main entry point for state changes (Event-driven).
   */
  public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void> {
    this.cleanCache();
    const rules = await this.ruleRepository.findAll();
    const correlationId = `auto-evt-${Date.now()}`;

    for (const rule of rules) {
      if (!rule.enabled) continue;

      if (rule.trigger.type === 'device_state_changed') {
        const trigger = rule.trigger as DeviceStateTrigger;
        if (matchDeviceStateTrigger(trigger, event)) {
          await this.fireRule(rule, correlationId, event.eventId);
        } else {
          await this.activityLogger.logSkippedMatch(rule, correlationId, event);
        }
      } else if (rule.trigger.type === 'compound') {
        const trigger = rule.trigger as CompoundTrigger;
        if (await evaluateCompound(trigger, event, null, null)) {
          await this.fireRule(rule, correlationId, event.eventId);
        } else {
          await this.activityLogger.logSkippedMatch(rule, correlationId, event);
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

        if (matchTimeTrigger(trigger, baseMoment, systemTimezone)) {
          this.timeFireGuard.set(rule.id, timeSlotKey);
          await this.fireRule(rule, `auto-time-${this.idGenerator.generate()}`);
          if (trigger.dateLocal) {
            await this.ruleRepository.delete(rule.id);
            if (rule.action.type === 'execute_scene') {
              const scene = await this.sceneRepository.findSceneById(rule.action.sceneId);
              if (scene?.homeId === rule.homeId && scene.userId === rule.userId) {
                await this.sceneRepository.deleteScene(scene.id);
              }
            }
          }
        }
      }
    }

    this.cleanCache();
  }

  // ─── Rule execution ───────────────────────────────────────────────────────────

  private async fireRule(rule: AutomationRule, correlationId: string, eventId?: string): Promise<void> {
    await this.executeRuleAction(rule, rule.action, correlationId, eventId);
  }

  private async executeRuleAction(
    rule: AutomationRule,
    action: AutomationAction,
    correlationId: string,
    eventId?: string
  ): Promise<void> {
    try {
      if (action.type === 'device_command') {
        const targetDevice = await this.deviceRepository.findDeviceById(action.targetDeviceId);
        if (!targetDevice) throw new Error(`Target device ${action.targetDeviceId} not found.`);

        // Skip if device is already in the desired state (turn_on/off only)
        const projected = projectCommandToState(action.command);
        const lastState = targetDevice.lastKnownState as Record<string, unknown> | null;
        if (projected !== null && lastState?.state === projected) {
          await this.activityLogger.logSkippedAction(rule, correlationId, eventId, action.targetDeviceId, 'skipped_target_state_match');
          return;
        }

        const loopPreventionKey = createLoopPreventionKey(rule, action);
        if (this.loopPreventionCache.has(loopPreventionKey)) {
          await this.activityLogger.logSkippedAction(rule, correlationId, eventId, action.targetDeviceId, 'skipped_loop_prevention');
          return;
        }
        this.loopPreventionCache.set(loopPreventionKey, Date.now());

        await this.commandDispatcher.dispatchCommand(
          targetDevice.homeId,
          action.targetDeviceId,
          action.command,
          correlationId,
          rule.id
        );
        await this.activityLogRepository.saveActivity({
          timestamp: new Date().toISOString(),
          deviceId: action.targetDeviceId,
          type: 'COMMAND_DISPATCHED',
          description: `Triggered by Automation: ${rule.name}`,
          correlationId,
          data: { ruleId: rule.id, ruleName: rule.name, command: action.command, status: 'success', eventId }
        });
        this.totalSuccesses++;
        this.lastExecutionAt = new Date().toISOString();
        this.lastStatus = 'active';
        return;
      }

      if (action.type === 'execute_scene') {
        const scene = await this.sceneRepository.findSceneById(action.sceneId);
        if (!scene || scene.homeId !== rule.homeId || !canAccessRoutine(scene, rule.userId)) {
          throw new Error('SCENE_ACCESS_DENIED');
        }
        await this.commandDispatcher.executeScene(rule.homeId, action.sceneId, correlationId, rule.id);
        this.totalSuccesses++;
        return;
      }
    } catch (error: unknown) {
      const dispatchError = error instanceof Error ? error : new Error(String(error));
      this.totalFailures++;
      this.lastExecutionAt = new Date().toISOString();
      this.lastStatus = 'error';
      await this.activityLogger.logExecution(
        rule,
        correlationId,
        'error',
        `Automation failed: ${dispatchError.message}`,
        action.type === 'device_command' ? action.targetDeviceId : undefined,
        eventId
      );
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

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

  // ─── Manual execution (dashboard "routine" action cards) ──────────────────────

  /**
   * Runs a rule's action immediately, bypassing its trigger/condition and the
   * loop-prevention cache — both exist to stop automations from re-firing
   * each other, not to stop a person from deliberately pressing a button.
   * Ownership must already be validated by the caller (route/use case).
   */
  public async runRuleNow(ruleId: string, correlationId: string): Promise<{ success: boolean; error?: string }> {
    const rule = await this.ruleRepository.findById(ruleId);
    if (!rule) return { success: false, error: 'AUTOMATION_NOT_FOUND' };

    const failuresBefore = this.totalFailures;
    await this.fireRule(rule, correlationId);
    if (this.totalFailures !== failuresBefore) {
      return { success: false, error: `Automation "${rule.name}" failed to run` };
    }
    return { success: true };
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
