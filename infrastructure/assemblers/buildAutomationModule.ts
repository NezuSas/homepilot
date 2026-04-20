/**
 * buildAutomationModule.ts
 *
 * Assembler: Construcción del motor de automatización (AutomationEngine),
 * su conexión con el SyncManager (HA) y EventBus (Local), y el timer del latido base.
 */
import { randomUUID } from 'crypto';
import { AutomationEngine } from '../../packages/automation/application/AutomationEngine';
import { executeDeviceCommandUseCase } from '../../packages/devices/application/executeDeviceCommandUseCase';
import type { DeviceStateUpdatedPayload } from '../../packages/devices/domain/events/types';
import type { SQLiteAutomationRuleRepository } from '../../packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SqliteSceneRepository } from '../../packages/devices/infrastructure/repositories/SqliteSceneRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { EventBusDeviceEventPublisher } from '../../packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import type { HomeAssistantConnectionProvider } from '../../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import type { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { HomeAssistantRealtimeSyncManager } from '../../packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import type { EventBus } from '../../packages/shared/domain/events/EventBus';

export interface AutomationModuleAssembly {
  automationEngine: AutomationEngine;
}

export interface AutomationModuleDeps {
  automationRuleRepository: SQLiteAutomationRuleRepository;
  deviceRepository: SQLiteDeviceRepository;
  sceneRepository: SqliteSceneRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  deviceEventPublisher: EventBusDeviceEventPublisher;
  connectionProvider: HomeAssistantConnectionProvider;
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
    deviceEventPublisher,
    connectionProvider,
    systemVariableService,
    syncManager,
    eventBus
  } = deps;

  const automationEngine = new AutomationEngine(
    automationRuleRepository,
    deviceRepository,
    sceneRepository,
    {
      dispatchCommand: async (homeId, deviceId, command, correlationId) => {
        const executeDeps = {
          deviceRepository,
          eventPublisher: deviceEventPublisher,
          topologyPort: {
            validateHomeExists: async () => {},
            validateHomeOwnership: async () => {},
            validateRoomBelongsToHome: async () => {}
          },
          dispatcherPort: {
            dispatch: async (dId: string, cmd: string) => {
               const target = await deviceRepository.findDeviceById(dId);
               if (!target || target.integrationSource !== 'ha') return;
               
               // parse HA externalId (format: "ha:domain.entity_id")
               const haEntityId = target.externalId.replace('ha:', '');
               const haDomain = haEntityId.split('.')[0] || 'homeassistant';

               let service = '';
               if (cmd === 'turn_on') service = 'turn_on';
               if (cmd === 'turn_off') service = 'turn_off';
               if (cmd === 'toggle') service = 'toggle';

               if (service) {
                  if (connectionProvider.hasClient()) {
                     await connectionProvider.getClient().callService(haDomain, service, haEntityId);
                  } else {
                     console.warn(`[Engine] Skipping HA command for ${target.externalId}: HA not configured.`);
                  }
               }
            }
          },
          activityLogRepository,
          idGenerator: { generate: () => randomUUID() },
          clock: { now: () => new Date().toISOString() }
        };

        await executeDeviceCommandUseCase(deviceId, command, 'system', correlationId, executeDeps, { isAutomation: true });
      },
      executeScene: async function(homeId, sceneId, correlationId) {
        const scene = await sceneRepository.findSceneById(sceneId);
        if (!scene) return;

        try {
          await activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: 'SCENE_EXECUTION_STARTED',
            description: `Automation triggered Scene "${scene.name}"`,
            data: { sceneId: scene.id, name: scene.name }
          });

          const results = await Promise.allSettled(
            scene.actions.map(action => this.dispatchCommand(homeId, action.deviceId, action.command, correlationId))
          );

          const failedCount = results.filter(r => r.status === 'rejected').length;
          const totalCount = scene.actions.length;

          if (failedCount === 0) {
            await activityLogRepository.saveActivity({
              timestamp: new Date().toISOString(),
              deviceId: null,
              correlationId,
              type: 'SCENE_EXECUTION_COMPLETED',
              description: `Scene "${scene.name}" executed successfully`,
              data: { sceneId: scene.id, totalCount }
            });
          } else {
            const isPartial = failedCount < totalCount;
            await activityLogRepository.saveActivity({
              timestamp: new Date().toISOString(),
              deviceId: null,
              correlationId,
              type: 'SCENE_EXECUTION_FAILED',
              description: `Scene "${scene.name}" ${isPartial ? 'partially' : 'fully'} failed (${failedCount}/${totalCount} errors)`,
              data: { sceneId: scene.id, failedCount, totalCount, isPartial }
            });
          }
        } catch (sceneErr: any) {
           console.error('[AutomationEngine] Fatal scene error:', sceneErr);
        }
      }
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

  return { automationEngine };
}
