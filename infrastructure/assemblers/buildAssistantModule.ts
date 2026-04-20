/**
 * buildAssistantModule.ts
 *
 * Assembler: Construcción del módulo del asistente (Assistant).
 * Incluye: Repositorios de findings, feedback y drafts, servicios de análisis
 * de comportamiento, contexto, energía y aprendizaje, y el servicio de detección.
 */
import { randomUUID } from 'crypto';
import { SQLiteAssistantFindingRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantFindingRepository';
import { SQLiteAssistantFeedbackRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantFeedbackRepository';
import { SQLiteAssistantDraftRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantDraftRepository';
import { AssistantLearningService } from '../../packages/assistant/application/AssistantLearningService';
import { ContextAnalysisService } from '../../packages/assistant/application/ContextAnalysisService';
import { AssistantDraftService } from '../../packages/assistant/application/AssistantDraftService';
import { BehaviorAnalysisService } from '../../packages/assistant/application/BehaviorAnalysisService';
import { EnergyAnalysisService } from '../../packages/assistant/application/EnergyAnalysisService';
import { AssistantDetectionService } from '../../packages/assistant/application/AssistantDetectionService';
import { AssistantService } from '../../packages/assistant/application/AssistantService';

import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SQLiteRoomRepository } from '../../packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import type { SQLiteAutomationRuleRepository } from '../../packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import type { SqliteSceneRepository } from '../../packages/devices/infrastructure/repositories/SqliteSceneRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { HomeAssistantClient } from '../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import type { EventBus } from '../../packages/shared/domain/events/EventBus';

export interface AssistantAssembly {
  assistantService: AssistantService;
  assistantRepository: SQLiteAssistantFindingRepository;
  assistantFeedbackRepository: SQLiteAssistantFeedbackRepository;
  assistantDraftRepository: SQLiteAssistantDraftRepository;
  assistantDraftService: AssistantDraftService;
}

export interface AssistantModuleDeps {
  dbPath: string;
  deviceRepository: SQLiteDeviceRepository;
  roomRepository: SQLiteRoomRepository;
  automationRuleRepository: SQLiteAutomationRuleRepository;
  sceneRepository: SqliteSceneRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  haClientProxy: HomeAssistantClient;
  eventBus: EventBus;
}

export function buildAssistantModule(deps: AssistantModuleDeps): AssistantAssembly {
  const {
    dbPath,
    deviceRepository,
    roomRepository,
    automationRuleRepository,
    sceneRepository,
    activityLogRepository,
    haClientProxy,
    eventBus
  } = deps;

  const assistantRepository = new SQLiteAssistantFindingRepository(dbPath);
  const assistantFeedbackRepository = new SQLiteAssistantFeedbackRepository(dbPath);
  const assistantDraftRepository = new SQLiteAssistantDraftRepository(dbPath);
  
  const assistantLearningService = new AssistantLearningService(assistantFeedbackRepository);
  const contextAnalysisService = new ContextAnalysisService(deviceRepository, roomRepository);
  
  const assistantDraftService = new AssistantDraftService(
    assistantDraftRepository,
    automationRuleRepository,
    sceneRepository,
    { generate: () => randomUUID() }
  );

  const behaviorService = new BehaviorAnalysisService(activityLogRepository, deviceRepository, contextAnalysisService);
  const energyAnalysisService = new EnergyAnalysisService(activityLogRepository, deviceRepository, contextAnalysisService);
  
  const assistantDetectionService = new AssistantDetectionService(
    deviceRepository, 
    haClientProxy, 
    contextAnalysisService, 
    behaviorService,
    assistantDraftService,
    energyAnalysisService
  );

  const assistantService = new AssistantService(
    assistantRepository, 
    assistantDetectionService,
    assistantLearningService,
    assistantFeedbackRepository
  );

  // -- EVENT-DRIVEN ASSISTANT SCANS --
  const assistantScanDebounceMs = 1500;
  const assistantScanCooldownMs = 30000;
  const assistantScanTimers = new Map<string, NodeJS.Timeout>();
  const assistantLastScanAtByHome = new Map<string, number>();

  const scheduleAssistantScan = (homeId: string, source: string): void => {
    if (!homeId) return;

    const existingTimer = assistantScanTimers.get(homeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const elapsedSinceLastScan = Date.now() - (assistantLastScanAtByHome.get(homeId) ?? 0);
    const remainingCooldownMs = Math.max(0, assistantScanCooldownMs - elapsedSinceLastScan);
    const delayMs = Math.max(assistantScanDebounceMs, remainingCooldownMs);

    const timer = setTimeout(() => {
      assistantScanTimers.delete(homeId);
      assistantLastScanAtByHome.set(homeId, Date.now());
      assistantService.scan(homeId, source).catch((error) => {
        console.error(`[Assistant] Event-driven scan failed for home ${homeId}:`, error);
      });
    }, delayMs);

    timer.unref?.();
    assistantScanTimers.set(homeId, timer);
  };

  eventBus.subscribe('HomeCreatedEvent', (event) => {
    const payload = event.payload as { id?: string };
    if (payload.id) {
      scheduleAssistantScan(payload.id, 'event_bus:home_created');
    }
  });

  eventBus.subscribe('RoomCreatedEvent', (event) => {
    const payload = event.payload as { homeId?: string };
    if (payload.homeId) {
      scheduleAssistantScan(payload.homeId, 'event_bus:room_created');
    }
  });

  eventBus.subscribe('DeviceDiscoveredEvent', (event) => {
    const payload = event.payload as { homeId?: string };
    if (payload.homeId) {
      scheduleAssistantScan(payload.homeId, 'event_bus:device_discovered');
    }
  });

  return { 
    assistantService, 
    assistantRepository, 
    assistantFeedbackRepository, 
    assistantDraftRepository, 
    assistantDraftService 
  };
}
