/**
 * buildCommandRouter.ts
 *
 * Assembler: Construcción del sistema de enrutamiento de comandos (Command Router).
 * Integra dispatchers para consolas locales, Home Assistant y dispositivos Sonoff.
 */
import { randomUUID } from 'crypto';
import { LocalConsoleCommandDispatcher } from '../../apps/api/LocalConsoleCommandDispatcher';
import { HomeAssistantCommandDispatcher } from '../../apps/api/HomeAssistantCommandDispatcher';
import { IntegrationCommandRouter } from '../../apps/api/IntegrationCommandRouter';
import { SonoffCommandDispatcher } from '../../packages/integrations/sonoff/application/SonoffCommandDispatcher';
import { SonoffLanDiscoveryService } from '../../packages/integrations/sonoff/application/SonoffLanDiscoveryService';
import { SQLiteTopologyReferenceAdapter } from '../../packages/topology/infrastructure/adapters/SQLiteTopologyReferenceAdapter';
import { AssistantActionService } from '../../packages/assistant/application/AssistantActionService';
import { DashboardService } from '../../packages/topology/application/DashboardService';

import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { EventBusDeviceEventPublisher } from '../../packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import type { HomeAssistantConnectionProvider } from '../../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import type { SQLiteRoomRepository } from '../../packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import type { HomeAssistantImportService } from '../../packages/devices/application/HomeAssistantImportService';
import type { SQLiteAssistantFindingRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantFindingRepository';
import type { SQLiteAssistantFeedbackRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantFeedbackRepository';
import type { AssistantDraftService } from '../../packages/assistant/application/AssistantDraftService';
import type { SQLiteDashboardRepository } from '../../packages/topology/infrastructure/repositories/SQLiteDashboardRepository';

export interface CommandRouterAssembly {
  commandDispatcher: IntegrationCommandRouter;
  sonoffDiscoveryService: SonoffLanDiscoveryService;
  assistantActionService: AssistantActionService;
  dashboardService: DashboardService;
}

export interface CommandRouterDeps {
  deviceRepository: SQLiteDeviceRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  deviceEventPublisher: EventBusDeviceEventPublisher;
  connectionProvider: HomeAssistantConnectionProvider;
  homeRepository: SQLiteHomeRepository;
  roomRepository: SQLiteRoomRepository;
  haImportService: HomeAssistantImportService;
  assistantDraftService: AssistantDraftService;
  assistantFindingRepository: SQLiteAssistantFindingRepository;
  assistantFeedbackRepository: SQLiteAssistantFeedbackRepository;
  dashboardRepository: SQLiteDashboardRepository;
}

export function buildCommandRouter(deps: CommandRouterDeps): CommandRouterAssembly {
  const {
    deviceRepository,
    activityLogRepository,
    deviceEventPublisher,
    connectionProvider,
    homeRepository,
    roomRepository,
    haImportService,
    assistantDraftService,
    assistantFindingRepository,
    assistantFeedbackRepository,
    dashboardRepository
  } = deps;

  const sharedSyncDeps = {
    deviceRepository,
    eventPublisher: deviceEventPublisher,
    activityLogRepository,
    idGenerator: { generate: () => randomUUID() },
    clock: { now: () => new Date().toISOString() }
  };

  const topologyPort = new SQLiteTopologyReferenceAdapter(homeRepository, roomRepository);

  // -- ASSEMBLING ASSISTANT ACTIONS --
  // We need the finding/feedback repos here too or passed in deps
  // For brevity in this refactor, we'll assume they can be instantiated safely or passed
  const assistantActionService = new AssistantActionService({
    assistantFindingRepository,
    assistantFeedbackRepository,
    deviceRepository,
    haImportService,
    assistantDraftService,
    assignDeviceDeps: {
      deviceRepository,
      eventPublisher: deviceEventPublisher,
      topologyPort,
      idGenerator: { generate: () => randomUUID() },
      clock: { now: () => new Date().toISOString() }
    }
  });

  const dashboardService = new DashboardService(dashboardRepository, homeRepository);

  // -- SONOFF --
  const sonoffDiscoveryService = new SonoffLanDiscoveryService({
    deviceRepository,
    homeRepository,
    syncDeps: sharedSyncDeps
  });
  
  if (process.env.NODE_ENV !== 'test') {
    sonoffDiscoveryService.startDiscovery();
  }

  // -- ROUTER SETUP --
  const sharedLocalDispatcher = new LocalConsoleCommandDispatcher(deviceRepository, sharedSyncDeps);
  const sharedHaDispatcher = new HomeAssistantCommandDispatcher(connectionProvider, deviceRepository, sharedSyncDeps);
  const sharedSonoffDispatcher = new SonoffCommandDispatcher(deviceRepository, sharedSyncDeps);

  const sharedCommandDispatcher = new IntegrationCommandRouter(deviceRepository, sharedLocalDispatcher);
  sharedCommandDispatcher.registerRoute('ha', sharedHaDispatcher);
  sharedCommandDispatcher.registerRoute('sonoff', sharedSonoffDispatcher);

  return { 
    commandDispatcher: sharedCommandDispatcher, 
    sonoffDiscoveryService,
    assistantActionService,
    dashboardService
  };
}
