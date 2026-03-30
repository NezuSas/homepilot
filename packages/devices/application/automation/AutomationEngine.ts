import { AutomationRuleRepository } from '../../domain/repositories/AutomationRuleRepository';
import { executeDeviceCommandUseCase, ExecuteDeviceCommandDependencies } from '../executeDeviceCommandUseCase';
import { ActivityLogRepository } from '../../domain/repositories/ActivityLogRepository';
import { IdGenerator, Clock } from '../../../shared/domain/types';

/**
 * Contrato de entrada para el Motor de Automatización V1.
 */
export interface DeviceStateUpdate {
  deviceId: string;
  newState: Record<string, unknown>;
}

/**
 * Motor central de automatizaciones reactivas.
 * Evalúa cambios de estado y dispara acciones inmutables.
 * Centraliza la auditoría de fallos de automatización para enriquecerla con datos de la regla.
 */
export class AutomationEngine {
  constructor(
    private readonly automationRuleRepository: AutomationRuleRepository,
    private readonly activityLogRepository: ActivityLogRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly executeCommandDeps: ExecuteDeviceCommandDependencies
  ) {}

  /**
   * Procesa un cambio de estado confirmado.
   * Itera sobre las reglas vinculadas al dispositivo disparador.
   */
  async handleDeviceStateUpdated(
    update: DeviceStateUpdate,
    correlationId: string
  ): Promise<void> {
    const activeRules = await this.automationRuleRepository.findByTriggerDevice(update.deviceId);

    for (const rule of activeRules) {
      try {
        const trigger = rule.trigger;
        const currentValue = update.newState[trigger.stateKey];

        // 1. Evaluación de la condición disparadora
        if (currentValue === trigger.expectedValue) {
          
          // 2. Ejecución delegada
          await executeDeviceCommandUseCase(
            rule.action.targetDeviceId,
            rule.action.command,
            rule.userId,
            correlationId,
            this.executeCommandDeps,
            {
              customDescription: `Triggered by Automation: ${rule.name}`,
              isAutomation: true
            }
          );
        }
      } catch (error: unknown) {
        // Fuente única de verdad para el log de fallo de automatización (REQ-09)
        const reason = error instanceof Error ? error.message : 'Unknown automation error';
        
        try {
          await this.activityLogRepository.saveActivity({
            timestamp: this.clock.now(),
            deviceId: rule.action.targetDeviceId,
            type: 'AUTOMATION_FAILED',
            description: `Automation failed: ${rule.name}. Reason: ${reason}`,
            data: { 
              ruleId: rule.id, 
              ruleName: rule.name,
              reason, 
              isAutomation: true 
            }
          });
        } catch (_logErr) {
          // El fallo de auditoría no debe romper la ejecución del motor
        }
      }
    }
  }
}
