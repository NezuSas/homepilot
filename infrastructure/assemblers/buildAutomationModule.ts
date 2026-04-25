/**
 * buildAutomationModule.ts
 *
 * Assembler: Construcción del motor de automatización (AutomationEngine),
 * su conexión con el SyncManager (HA) y EventBus (Local), y el timer del latido base.
 */
import { randomUUID } from 'crypto';
import { AutomationEngine } from '../../packages/automation/application/AutomationEngine';
import { SceneExecutionService } from '../../packages/devices/application/SceneExecutionService';
import type { DeviceStateUpdatedPayload } from '../../packages/devices/domain/events/types';
import type { SQLiteAutomationRuleRepository } from '../../packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SqliteSceneRepository } from '../../packages/devices/infrastructure/repositories/SqliteSceneRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import type { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { HomeAssistantRealtimeSyncManager } from '../../packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import type { EventBus } from '../../packages/shared/domain/events/EventBus';

export interface AutomationModuleAssembly {
  automationEngine: AutomationEngine;
  sceneExecutionService: SceneExecutionService;
}

export interface AutomationModuleDeps {
  automationRuleRepository: SQLiteAutomationRuleRepository;
  deviceRepository: SQLiteDeviceRepository;
  sceneRepository: SqliteSceneRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  executionRecordRepository: import('../../packages/devices/infrastructure/repositories/SQLiteExecutionRecordRepository').SQLiteExecutionRecordRepository;
  commandDispatcher: DeviceCommandDispatcherPort;
  systemVariableService: SystemVariableService;
  syncManager: HomeAssistantRealtimeSyncManager;
  eventBus: EventBus;
}

export function buildAutomationModule(deps: AutomationModuleDeps): AutomationModuleAssembly {
  const {
    automationRuleRepository,
    deviceRepository,
    sceneRepository,
    activityLogRepository,
    executionRecordRepository,
    commandDispatcher,
    systemVariableService,
    syncManager,
    eventBus
  } = deps;

  const sceneExecutionService = new SceneExecutionService(commandDispatcher, executionRecordRepository);

  const automationEngine = new AutomationEngine(
    automationRuleRepository,
    deviceRepository,
    sceneRepository,
    {
      /**
       * dispatchCommand — Ejecuta un comando individual sobre un dispositivo.
       * Crea una escena sintética de una sola acción en modo parallel
       * y la delega a SceneExecutionService → DeviceCommandService.
       */
      dispatchCommand: async (homeId: string, deviceId: string, command: string, correlationId: string, ruleId: string) => {
        const result = await sceneExecutionService.execute({
          id: `automation:${correlationId}`,
          homeId,
          roomId: null,
          name: `[Auto] ${command}`,
          actions: [{
            deviceId,
            command: {
              name: command as import('../../packages/devices/domain/commands').DeviceCommandV1,
              metadata: { source: 'automation', correlationId },
            },
          }],
          executionMode: 'parallel',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }, {
          sourceType: 'automation',
          sourceId: ruleId,
          correlationId,
        });

        if (result.status === 'failed') {
          const failedAction = result.actions[0];
          throw new Error(failedAction?.error ?? `Command ${command} failed on device ${deviceId}`);
        }
      },

      /**
       * executeScene — Ejecuta una escena completa via SceneExecutionService.
       * Respeta el executionMode configurado en la escena (parallel por defecto).
       */
      executeScene: async (homeId: string, sceneId: string, correlationId: string, ruleId: string) => {
        const scene = await sceneRepository.findSceneById(sceneId);
        if (!scene) return;

        try {
          await activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: 'SCENE_EXECUTION_STARTED',
            description: `Automation triggered Scene "${scene.name}"`,
            data: { sceneId: scene.id, name: scene.name, executionMode: scene.executionMode ?? 'parallel' },
          });

          const execResult = await sceneExecutionService.execute(scene, {
            sourceType: 'automation',
            sourceId: ruleId,
            correlationId,
          });

          const failedCount = execResult.actions.filter(a => a.status === 'failed').length;
          const totalCount = execResult.actions.length;

          console.log(
            `[Automation] Scene executed — sceneId=${scene.id} status=${execResult.status} ` +
            `totalActions=${totalCount} failedActions=${failedCount}`
          );

          const logType = execResult.status === 'success' ? 'SCENE_EXECUTION_COMPLETED' : 'SCENE_EXECUTION_FAILED';
          await activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: logType,
            description: `Scene "${scene.name}" ${execResult.status} (${totalCount - failedCount}/${totalCount} success)`,
            data: {
              sceneId: scene.id,
              failedCount,
              totalCount,
              isPartial: execResult.status === 'partial',
              executionMode: scene.executionMode ?? 'parallel',
            },
          });
        } catch (sceneErr: unknown) {
          console.error('[AutomationEngine] Fatal scene error:', sceneErr instanceof Error ? sceneErr.message : sceneErr);
        }
      },
    },
    activityLogRepository,
    systemVariableService,
    { generate: () => randomUUID() }
  );

  syncManager.removeAllListeners('system_event');
  syncManager.on('system_event', (event) => {
    automationEngine.handleSystemEvent(event).catch(e => console.error('[Engine] Fallo asíncrono:', e.message));
  });

  // Wire Engine to the EventBus for local/non-HA status changes
  eventBus.subscribe('DeviceStateUpdatedEvent', async (event) => {
    const payload = event.payload as DeviceStateUpdatedPayload;
    const systemEvent: any = {
      eventId: event.eventId,
      occurredAt: event.timestamp,
      source: 'local_sensor',
      deviceId: payload.deviceId,
      externalId: 'local:' + payload.deviceId, // Fallback si no está fácilmente disponible
      newState: payload.newState || {}
    };
    
    await automationEngine.handleSystemEvent(systemEvent);
  });

  // 4.2. Latido auto-corregido alineado a fronteras de minuto UTC (HH:mm:00)
  const startHeartbeat = () => {
    const scheduleNext = () => {
      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      const safeDelay = msToNextMinute < 100 ? msToNextMinute + 60000 : msToNextMinute;

      setTimeout(() => {
        const triggerDate = new Date();
        const currentTimeUTC = triggerDate.toISOString().slice(11, 16);

        console.log(`[Pulse] Minute Boundary Reached (UTC): ${currentTimeUTC}`);
        automationEngine.handleTimeEvent(currentTimeUTC, triggerDate).catch(e =>
          console.error('[Engine] Fallo en pulso de tiempo:', e.message)
        );

        scheduleNext();
      }, safeDelay).unref();
    };

    scheduleNext();
    console.log('[Bootstrap] Self-correcting minute heartbeat scheduled.');
  };

  startHeartbeat();

  return { automationEngine, sceneExecutionService };
}
