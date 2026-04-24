/**
 * buildCommandRouter.ts
 *
 * Assembler: Construcción del sistema de enrutamiento de comandos (Command Router).
 * Integra dispatchers para consolas locales, Home Assistant y dispositivos Sonoff.
 */
import { randomUUID } from 'crypto';
import { DeviceCommandService } from '../../packages/devices/application/DeviceCommandService';
import { DefaultDeviceDriverRegistry } from '../../packages/devices/infrastructure/drivers/DefaultDeviceDriverRegistry';
import { LocalDeviceDriver } from '../../packages/devices/infrastructure/drivers/LocalDeviceDriver';
import { HomeAssistantDeviceDriver } from '../../packages/integrations/home-assistant/infrastructure/HomeAssistantDeviceDriver';
import { SonoffDeviceDriver } from '../../packages/integrations/sonoff/infrastructure/SonoffDeviceDriver';
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
  commandDispatcher: DeviceCommandService;
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

  // -- DRIVER LAYER SETUP --
  const driverRegistry = new DefaultDeviceDriverRegistry();
  
  // Registrar drivers
  driverRegistry.register('ha', new HomeAssistantDeviceDriver(connectionProvider));
  driverRegistry.register('home_assistant', new HomeAssistantDeviceDriver(connectionProvider));
  driverRegistry.register('sonoff', new SonoffDeviceDriver());
  driverRegistry.register('local', new LocalDeviceDriver());

  const deviceCommandService = new DeviceCommandService(
    deviceRepository,
    driverRegistry,
    sharedSyncDeps
  );

  return { 
    commandDispatcher: deviceCommandService, 
    sonoffDiscoveryService,
    assistantActionService,
    dashboardService
  };
}
