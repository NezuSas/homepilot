import { ActivityLogRepository, ActivityType } from '../../../devices/domain/repositories/ActivityLogRepository';
import type { AutomationRule } from '../../../devices/domain/automation/types';

export type SkippedActionStatus = 'skipped_loop_prevention' | 'skipped_target_state_match';

/**
 * Registro en activity log de los resultados de ejecución de automatizaciones.
 */
export class AutomationActivityLogger {
  constructor(private readonly activityLogRepository: ActivityLogRepository) {}

  public async logSkippedAction(
    rule: AutomationRule,
    correlationId: string,
    eventId: string | undefined,
    deviceId: string,
    status: SkippedActionStatus
  ): Promise<void> {
    await this.activityLogRepository.saveActivity({
      timestamp: new Date().toISOString(),
      deviceId,
      type: 'AUTOMATION_EXECUTED',
      description: `Automation "${rule.name}" skipped: ${status}.`,
      correlationId,
      data: { ruleId: rule.id, ruleName: rule.name, status, eventId },
    });
  }

  public async logExecution(
    rule: AutomationRule,
    correlationId: string,
    status: 'success' | 'error',
    reason: string,
    deviceId: string | null = null,
    eventId?: string
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
          eventId,
        },
      });
    } catch {
      // Logging failures must not block the automation pipeline.
    }
  }
}
