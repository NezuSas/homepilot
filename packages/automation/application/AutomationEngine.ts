import { AutomationRuleRepository } from '../../devices/domain/repositories/AutomationRuleRepository';
import { DeviceRepository } from '../../devices/domain/repositories/DeviceRepository';
import { ActivityLogRepository } from '../../devices/domain/repositories/ActivityLogRepository';
import { SystemStateChangeEvent } from '../../integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

/**
 * Puerto de Entrada simple para el Dispatch. 
 * Permite inyectar executeDeviceCommandUseCase o un llamador directo de hardware.
 */
export interface AutomationCommandDispatcher {
  dispatchCommand(
    homeId: string, 
    deviceId: string, 
    command: string, 
    correlationId: string
  ): Promise<void>;
}

export class AutomationEngine {
  // Ventana de deduplicación in-memory (2000 ms) para evitar ecos.
  private readonly loopPreventionCache = new Map<string, number>();
  private readonly DEDUPLICATION_WINDOW_MS = 2000;

  constructor(
    private readonly ruleRepository: AutomationRuleRepository,
    private readonly deviceRepository: DeviceRepository,
    private readonly commandDispatcher: AutomationCommandDispatcher,
    private readonly activityLogRepository: ActivityLogRepository
  ) {
    // Cronjob primitivo para limpiar fugas de memoria en la caché de deduplicación
    setInterval(() => this.cleanCache(), 60000).unref();
  }

  public async handleSystemEvent(event: SystemStateChangeEvent): Promise<void> {
    try {
      // 1. Obtener reglas asociadas a este disparador (Optimizando la carga)
      const cachedRules = await this.ruleRepository.findByTriggerDevice(event.deviceId);
      
      // 2. Filtrar reglas activas
      const activeRules = cachedRules.filter(r => r.enabled);

      if (activeRules.length === 0) return;

      for (const rule of activeRules) {
        try {
          await this.evaluateAndExecuteRule(rule, event);
        } catch (ruleError: any) {
          console.error(`[AutomationEngine] Error aislando regla ${rule.id}:`, ruleError.message);
          // Si falla una regla en particular aisalada por DB o Typo, el resto puede seguir
        }
      }
    } catch (globalError: any) {
      console.error(`[AutomationEngine] Falla severa procesando evento:`, globalError.message);
    }
  }

  private async evaluateAndExecuteRule(rule: any, event: SystemStateChangeEvent): Promise<void> {
    const { stateKey, expectedValue } = rule.trigger;
    const { targetDeviceId, command } = rule.action;

    // 1. Resolver el valor de evaluación actual en el evento
    let currentValue: any = undefined;
    if (stateKey === 'state') {
      currentValue = event.newState.state;
    } else if (event.newState.attributes && stateKey in event.newState.attributes) {
      currentValue = event.newState.attributes[stateKey];
    } else if (event.previousState && event.previousState.attributes && stateKey in event.previousState.attributes) {
      // Missing attribute usually implies it did not change and HA drops it from the diff, 
      // but in standard states, if it's undefined, it's unmatched.
      currentValue = undefined; 
    }

    // 2. Check de Coincidencia (Match)
    // Se fuerza equivalencia de String a String para ser estrictos con el payload HA
    if (String(currentValue) !== String(expectedValue)) {
      await this.logExecution(rule, event, 'skipped_no_match', `Event value '${currentValue}' does not match expected '${expectedValue}'.`);
      return;
    }

    // 3. Prevención Robusta de Loops (Rebotes en la misma acción)
    // Crear firma unívoca
    const cacheSignature = `${rule.id}:${targetDeviceId}:${command}:${expectedValue}`;
    const now = Date.now();
    const lastExecution = this.loopPreventionCache.get(cacheSignature);

    if (lastExecution && (now - lastExecution) < this.DEDUPLICATION_WINDOW_MS) {
      await this.logExecution(rule, event, 'skipped_loop_prevention', `Duplicate trigger blocked within ${this.DEDUPLICATION_WINDOW_MS}ms window.`);
      return;
    }
    
    // Registrar el intento actual en la cache de ventana
    this.loopPreventionCache.set(cacheSignature, now);

    // 4. Verificación terminal del Target Device State
    const targetDevice = await this.deviceRepository.findDeviceById(targetDeviceId);
    if (!targetDevice) {
      await this.logExecution(rule, event, 'error', `Target device ${targetDeviceId} not found.`);
      return; // Skip and avoid exception mapping breaking loop
    }

    // Traducir 'turn_on' a un state lógico 'on' para comprobación heurística (V2 Base)
    const projectedState = this.projectCommandToState(command);
    if (projectedState && targetDevice.lastKnownState?.state === projectedState) {
      await this.logExecution(rule, event, 'skipped_target_state_match', `Target device is already in requested state '${projectedState}'.`);
      return;
    }

    // 5. Ejecutar Acción (Dispatch)
    try {
      await this.commandDispatcher.dispatchCommand(
        targetDevice.homeId,
        targetDeviceId,
        command,
        event.eventId
      );
      
      await this.logExecution(rule, event, 'success', `Automation successful.`);
    } catch (dispatchError: any) {
      await this.logExecution(rule, event, 'error', `Command dispatch failed: ${dispatchError.message}`);
    }
  }

  private projectCommandToState(command: string): string | null {
    if (command === 'turn_on') return 'on';
    if (command === 'turn_off') return 'off';
    // toggle no proyecta un estado estático asumible localmente
    return null;
  }

  private async logExecution(
    rule: any, 
    event: SystemStateChangeEvent, 
    status: 'success' | 'error' | 'skipped_loop_prevention' | 'skipped_target_state_match' | 'skipped_no_match',
    reason: string
  ): Promise<void> {
    try {
      await this.activityLogRepository.saveActivity({
        timestamp: new Date().toISOString(),
        deviceId: event.deviceId,
        type: status === 'error' ? 'AUTOMATION_FAILED' : 'COMMAND_DISPATCHED', // Repurposing since 'AUTOMATION_EVALUATED' not in type mapping yet
        description: reason,
        data: {
          ruleId: rule.id,
          targetDeviceId: rule.action.targetDeviceId,
          command: rule.action.command,
          status,
          executedAt: new Date().toISOString(),
          eventId: event.eventId
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
  }
}
