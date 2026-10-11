import { ActivityLogRepository } from '../../../../devices/domain/repositories/ActivityLogRepository';
import { logRuntimeDiagnostic } from '../../../../shared/config/runtimeEnvironment';
import type { ResilienceEventLogger } from './syncTypes';
import { getErrorMessage } from './stateChangeMapping';

/** Crea el registrador de eventos HA_RESILIENCE sobre el activity log (fire-and-forget). */
export function createResilienceEventLogger(activityLogRepository: ActivityLogRepository): ResilienceEventLogger {
  return (source, attempt, delayMs, reason, reconciledDevices, skippedDevices) => {
    activityLogRepository.saveActivity({
      timestamp: new Date().toISOString(),
      deviceId: null, // LOG-1: resilience events are not device-scoped
      type: 'HA_RESILIENCE',
      description: reason,
      data: {
        source,
        attempt,
        delayMs,
        reconciledDevices,
        skippedDevices,
        reason
      }
    }).catch((error: unknown) => logRuntimeDiagnostic('warn', '[HA-Sync] Log de resiliencia falló:', getErrorMessage(error)));
  };
}
