import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SceneRepository } from '../../devices/domain/repositories/SceneRepository';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import { ObservableAutomationEngineStateProvider, AutomationEngineObservableState } from '../../system-observability/domain/ObservableStateProviders';
import { AutomationRule, DeviceStateTrigger, TimeTrigger } from '../../devices/domain/automation/types';

/**
 * Puerto de Entrada simple para el Dispatch. 
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
  // Ventana de deduplicación in-memory (2000 ms) para evitar ecos en eventos de dispositivo.
  private readonly loopPreventionCache = new Map<string, number>();
  private readonly DEDUPLICATION_WINDOW_MS = 2000;

  // Guard para evitar que reglas de tiempo se disparen múltiples veces en el mismo minuto.
  // key: ruleId, value: last fired "YYYY-MM-DD HH:mm"
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
    private readonly activityLogRepository: ActivityLogRepository
  ) {
    // Cronjob primitivo para limpiar fugas de memoria en la caché de deduplicación
    setInterval(() => this.cleanCache(), 60000).unref();
  }

  /**
   * Procesa eventos de cambio de estado de dispositivos.
   */
  public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void> {
    try {
      const cachedRules = await this.ruleRepository.findByTriggerDevice(event.deviceId);
      const activeRules = cachedRules.filter(r => r.enabled);

      for (const rule of activeRules) {
        if (rule.trigger.type === 'device_state_changed') {
          try {
            await this.evaluateAndExecuteDeviceRule(rule, event);
          } catch (ruleError: any) {
            console.error(`[AutomationEngine] Error aislando regla ${rule.id} (correlationId: ${event.eventId}):`, ruleError.message);
          }
        }
      }
    } catch (globalError: any) {
      this.lastStatus = 'error';
      console.error(`[AutomationEngine] Falla severa procesando evento:`, globalError.message);
    }
  }

  /**
   * Procesa eventos de tiempo (pulso de 60s).
   * @param currentTime "HH:mm" (SIEMPRE EN UTC)
   */
  public async handleTimeEvent(currentTime: string): Promise<void> {
    try {
      const allRules = await this.ruleRepository.findAll();
      const timeRules = allRules.filter(r => r.enabled && r.trigger.type === 'time');
      
      const now = new Date();
      const currentDay = now.getDay(); // 0 is Sunday, matching our types potentially

      for (const rule of timeRules) {
        const trigger = rule.trigger as TimeTrigger;
        
        // 1. Check time match (STRICT UTC COMPARISON)
        const targetTime = trigger.timeUTC || trigger.time; // Soporte legacy
        if (targetTime !== currentTime) continue;

        // 2. Check day match (if specified)
        // Nota: Si usamos UTC, el día también debería ser relativo a UTC si queremos perfección,
        // pero por ahora mantenemos el día local para evitar complejidad excesiva en V1 
        // a menos que el usuario sea muy estricto con el cruce de medianoche UTC.
        if (trigger.days && trigger.days.length > 0 && !trigger.days.includes(currentDay)) continue;

        // 3. Once-per-minute guard (strictly tied to Date + HH:mm)
        const dateStr = now.toISOString().split('T')[0];
        const fireKey = `${dateStr} ${currentTime}`;
        
        if (this.timeFireGuard.get(rule.id) === fireKey) continue;
        
        this.timeFireGuard.set(rule.id, fireKey);
        
        try {
          await this.executeRuleActions(rule, `time:${currentTime}`);
        } catch (ruleError: any) {
          console.error(`[AutomationEngine] Error ejecutando regla de tiempo ${rule.id}:`, ruleError.message);
        }
      }
    } catch (globalError: any) {
      console.error(`[AutomationEngine] Falla procesando evento de tiempo:`, globalError.message);
    }
  }

  private async evaluateAndExecuteDeviceRule(rule: AutomationRule, event: SystemStateChangeEvent): Promise<void> {
    const trigger = rule.trigger as DeviceStateTrigger;
    const { stateKey, expectedValue } = trigger;

    // 1. Resolver el valor de evaluación actual en el evento
    let currentValue: any = undefined;
    if (stateKey === 'state') {
      currentValue = event.newState.state;
    } else if (event.newState.attributes && stateKey in event.newState.attributes) {
      currentValue = event.newState.attributes[stateKey];
    }

    // 2. Check de Coincidencia (Match)
    if (String(currentValue) !== String(expectedValue)) {
      return;
    }

    // 3. Prevención de Loops (Rebotes en la misma acción)
    // Firma: ruleId + valor esperado para evitar spam en el mismo cambio
    const cacheSignature = `${rule.id}:${expectedValue}`;
    const now = Date.now();
    const lastExecution = this.loopPreventionCache.get(cacheSignature);

    if (lastExecution && (now - lastExecution) < this.DEDUPLICATION_WINDOW_MS) {
      return;
    }
    this.loopPreventionCache.set(cacheSignature, now);

    // 4. Ejecutar
    await this.executeRuleActions(rule, event.eventId);
  }

  private async executeRuleActions(rule: AutomationRule, correlationId: string): Promise<void> {
    const { action } = rule;

    try {
      if (action.type === 'device_command') {
        const targetDevice = await this.deviceRepository.findDeviceById(action.targetDeviceId);
        if (!targetDevice) throw new Error(`Target device ${action.targetDeviceId} not found.`);

        // Optimización: si ya está en ese estado, saltar (solo para turn_on/off simples)
        const projected = this.projectCommandToState(action.command);
        if (projected && targetDevice.lastKnownState?.state === projected) {
          return;
        }

        await this.commandDispatcher.dispatchCommand(
          targetDevice.homeId,
          action.targetDeviceId,
          action.command,
          correlationId
        );
      } else if (action.type === 'execute_scene') {
        const scene = await this.sceneRepository.findSceneById(action.sceneId);
        if (!scene) throw new Error(`Scene ${action.sceneId} not found.`);

        await this.commandDispatcher.executeScene(
          scene.homeId,
          action.sceneId,
          correlationId
        );
      }

      this.totalSuccesses++;
      this.lastExecutionAt = new Date().toISOString();
      this.lastStatus = 'active';
      await this.logExecution(rule, correlationId, 'success', `Automation successful.`);
    } catch (dispatchError: any) {
      this.totalFailures++;
      this.lastExecutionAt = new Date().toISOString();
      this.lastStatus = 'error';
      await this.logExecution(rule, correlationId, 'error', `Automation failed: ${dispatchError.message}`);
      throw dispatchError; // Repropagar para el logger de arriba si es necesario
    }
  }

  private projectCommandToState(command: string): string | null {
    if (command === 'turn_on') return 'on';
    if (command === 'turn_off') return 'off';
    return null;
  }

  private async logExecution(
    rule: AutomationRule, 
    correlationId: string,
    status: 'success' | 'error',
    reason: string
  ): Promise<void> {
    try {
      await this.activityLogRepository.saveActivity({
        timestamp: new Date().toISOString(),
        deviceId: 'system',
        type: status === 'error' ? 'AUTOMATION_FAILED' : 'COMMAND_DISPATCHED',
        description: `[Automation: ${rule.name}] ${reason} (correlationId: ${correlationId})`,
        data: {
          ruleId: rule.id,
          trigger: rule.trigger,
          action: rule.action,
          status: status === 'error' ? 'failed' : 'executed',
          correlationId,
          timestamp: new Date().toISOString()
        }
      });
    } catch {
      // Ignorar fallos de logging para no frenar pipeline
    }
  }

  private cleanCache() {
    const expired = Date.now() - this.DEDUPLICATION_WINDOW_MS;
    for (const [key, timestamp] of this.loopPreventionCache.entries()) {
      if (timestamp < expired) {
        this.loopPreventionCache.delete(key);
      }
    }
    // Opcional: limpiar timeFireGuard si llega a ser muy grande, 
    // pero usualmente HH:mm cambia y se sobreescribe. 
    // Limpiemos entradas de días anteriores.
  }

  // ─── Observable State Provider ───────────────────────────────────────────────

  public getObservableState(): AutomationEngineObservableState {
    let currentStatus = this.lastStatus;
    if (currentStatus === 'active' && this.lastExecutionAt) {
      const msSinceLast = Date.now() - new Date(this.lastExecutionAt).getTime();
      if (msSinceLast > 5 * 60 * 1000) {
        currentStatus = 'idle';
      }
    }

    return {
      status: currentStatus,
      lastExecutionAt: this.lastExecutionAt,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures
    };
  }
}
