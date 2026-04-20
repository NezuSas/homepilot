import { buildDatabase } from './infrastructure/assemblers/buildDatabase';
import { buildEventBus } from './infrastructure/assemblers/buildEventBus';
import { buildRepositories } from './infrastructure/assemblers/buildRepositories';
import { buildHomeAssistantModule } from './infrastructure/assemblers/buildHomeAssistantModule';
import { buildSystemVarsModule } from './infrastructure/assemblers/buildSystemVarsModule';
import { buildAutomationModule } from './infrastructure/assemblers/buildAutomationModule';
import { buildAuthModule } from './infrastructure/assemblers/buildAuthModule';
import { buildAssistantModule } from './infrastructure/assemblers/buildAssistantModule';
import { buildCommandRouter } from './infrastructure/assemblers/buildCommandRouter';
import { DiagnosticsService } from './packages/system-observability/application/DiagnosticsService';

import type { SQLiteDashboardRepository } from './packages/topology/infrastructure/repositories/SQLiteDashboardRepository';
import type { SQLiteHomeRepository } from './packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import type { SQLiteRoomRepository } from './packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import type { SQLiteDeviceRepository } from './packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SqliteSceneRepository } from './packages/devices/infrastructure/repositories/SqliteSceneRepository';
import type { SQLiteAutomationRuleRepository } from './packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import type { SQLiteActivityLogRepository } from './packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { SQLiteSettingsRepository } from './packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import type { SqliteUserRepository } from './packages/auth/infrastructure/SqliteUserRepository';
import type { SqliteSessionRepository } from './packages/auth/infrastructure/SqliteSessionRepository';
import type { SqliteSystemSetupRepository } from './packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import type { SqliteSystemVariableRepository } from './packages/system-vars/infrastructure/SqliteSystemVariableRepository';
import type { DashboardService } from './packages/topology/application/DashboardService';
import type { HomeAssistantSettingsService } from './packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import type { AuthService } from './packages/auth/application/AuthService';
import type { SystemSetupService } from './packages/system-setup/application/SystemSetupService';
import type { UserManagementService } from './packages/auth/application/UserManagementService';
import type { AssistantService } from './packages/assistant/application/AssistantService';
import type { AssistantActionService } from './packages/assistant/application/AssistantActionService';
import type { HomeAssistantImportService } from './packages/devices/application/HomeAssistantImportService';
import type { SystemVariableService } from './packages/system-vars/application/SystemVariableService';
import type { SonoffLanDiscoveryService } from './packages/integrations/sonoff/application/SonoffLanDiscoveryService';
import type { AuthGuard } from './packages/auth/infrastructure/AuthGuard';
import type { HomeAssistantConnectionProvider } from './packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import type { HomeAssistantClient } from './packages/devices/infrastructure/adapters/HomeAssistantClient';
import type { DeviceCommandDispatcherPort } from './packages/devices/application/ports/DeviceCommandDispatcherPort';
import type { EventBusDeviceEventPublisher } from './packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import type { EventBusTopologyEventPublisher } from './packages/topology/infrastructure/adapters/EventBusTopologyEventPublisher';
import type { EventBus } from './packages/shared/domain/events/EventBus';
import type { AutomationEngine } from './packages/automation/application/AutomationEngine';

export interface BootstrapContainer {
  repositories: {
    dashboardRepository: SQLiteDashboardRepository;
    homeRepository: SQLiteHomeRepository;
    roomRepository: SQLiteRoomRepository;
    deviceRepository: SQLiteDeviceRepository;
    sceneRepository: SqliteSceneRepository;
    automationRuleRepository: SQLiteAutomationRuleRepository;
    activityLogRepository: SQLiteActivityLogRepository;
    settingsRepository: SQLiteSettingsRepository;
    userRepository: SqliteUserRepository;
    sessionRepository: SqliteSessionRepository;
    systemSetupRepository: SqliteSystemSetupRepository;
    systemVariableRepository: SqliteSystemVariableRepository;
  };
  services: {
    dashboardService: DashboardService;
    homeAssistantSettingsService: HomeAssistantSettingsService;
    diagnosticsService: DiagnosticsService;
    authService: AuthService;
    systemSetupService: SystemSetupService;
    userManagementService: UserManagementService;
    assistantService: AssistantService;
    assistantActionService: AssistantActionService;
    haImportService: HomeAssistantImportService;
    systemVariableService: SystemVariableService;
    sonoffDiscoveryService: SonoffLanDiscoveryService;
  };
  guards: {
    authGuard: AuthGuard;
  };
  adapters: {
    homeAssistantConnectionProvider: HomeAssistantConnectionProvider;
    homeAssistantClient: HomeAssistantClient;
    commandDispatcher: DeviceCommandDispatcherPort;
    deviceEventPublisher: EventBusDeviceEventPublisher;
    topologyEventPublisher: EventBusTopologyEventPublisher;
  };
  eventBus: EventBus;
  dbPath: string;
  engine?: AutomationEngine;
}

export interface BootstrapOptions {
  dbPath?: string;
  migrationsDir?: string;
  verbose?: boolean;
}

/**
 * Bootstrap (Composition Root) - Refactorizado como orquestador liviano.
 */
export async function bootstrap(options?: BootstrapOptions): Promise<BootstrapContainer> {
  const isVerbose = options?.verbose ?? process.env.NODE_ENV !== 'production';

  // 1. Persistencia y Eventos (Core Infrastructure)
  const { db, dbPath } = buildDatabase({
    rawDbPath: options?.dbPath || process.env.HOMEPILOT_DB_PATH || 'homepilot.local.db',
    migrationsDir: options?.migrationsDir,
    verbose: isVerbose
  });

  const { eventBus, deviceEventPublisher, topologyEventPublisher } = buildEventBus();

  // 2. Repositorios y Módulos Base
  const repos = buildRepositories(dbPath, db);
  
  const haModule = await buildHomeAssistantModule({
    settingsRepository: repos.settingsRepository,
    deviceRepository: repos.deviceRepository,
    activityLogRepository: repos.activityLogRepository,
    homeRepository: repos.homeRepository
  });

  const { systemVariableService } = await buildSystemVarsModule({
    systemVariableRepository: repos.systemVariableRepository
  });

  // 3. Motores de Reglas y Lógica de Negocio
  const { automationEngine } = buildAutomationModule({
    automationRuleRepository: repos.automationRuleRepository,
    deviceRepository: repos.deviceRepository,
    sceneRepository: repos.sceneRepository,
    activityLogRepository: repos.activityLogRepository,
    deviceEventPublisher,
    connectionProvider: haModule.connectionProvider,
    systemVariableService,
    syncManager: haModule.syncManager,
    eventBus
  });

  const diagnosticsService = new DiagnosticsService(
    haModule.settingsService,
    haModule.syncManager,
    automationEngine,
    repos.activityLogRepository,
    systemVariableService
  );

  // 4. Seguridad, Onboarding y Assistant
  const authModule = await buildAuthModule({
    db,
    dbPath,
    homeRepository: repos.homeRepository,
    settingsRepository: repos.settingsRepository,
    settingsService: haModule.settingsService,
    activityLogRepository: repos.activityLogRepository
  });

  const assistantAssembly = buildAssistantModule({
    dbPath,
    deviceRepository: repos.deviceRepository,
    roomRepository: repos.roomRepository,
    automationRuleRepository: repos.automationRuleRepository,
    sceneRepository: repos.sceneRepository,
    activityLogRepository: repos.activityLogRepository,
    haClientProxy: haModule.haClientProxy,
    eventBus
  });

  // 5. Enrutamiento de Comandos
  const commandRouterAssembly = buildCommandRouter({
    deviceRepository: repos.deviceRepository,
    activityLogRepository: repos.activityLogRepository,
    deviceEventPublisher,
    connectionProvider: haModule.connectionProvider,
    homeRepository: repos.homeRepository,
    roomRepository: repos.roomRepository,
    haImportService: haModule.haImportService,
    assistantDraftService: assistantAssembly.assistantDraftService,
    assistantFindingRepository: assistantAssembly.assistantRepository,
    assistantFeedbackRepository: assistantAssembly.assistantFeedbackRepository,
    dashboardRepository: repos.dashboardRepository
  });

  const container: BootstrapContainer = {
    repositories: {
      ...repos,
      userRepository: authModule.userRepository,
      sessionRepository: authModule.sessionRepository,
      systemSetupRepository: authModule.systemSetupRepository
    },
    services: {
      dashboardService: commandRouterAssembly.dashboardService,
      homeAssistantSettingsService: haModule.settingsService,
      diagnosticsService,
      authService: authModule.authService,
      systemSetupService: authModule.systemSetupService,
      userManagementService: authModule.userManagementService,
      assistantService: assistantAssembly.assistantService,
      assistantActionService: commandRouterAssembly.assistantActionService,
      haImportService: haModule.haImportService,
      systemVariableService,
      sonoffDiscoveryService: commandRouterAssembly.sonoffDiscoveryService
    },
    guards: {
      authGuard: authModule.authGuard
    },
    adapters: {
      homeAssistantConnectionProvider: haModule.connectionProvider,
      homeAssistantClient: haModule.haClientProxy,
      commandDispatcher: commandRouterAssembly.commandDispatcher,
      deviceEventPublisher,
      topologyEventPublisher
    },
    eventBus,
    dbPath,
    engine: automationEngine
  };

  console.log('[Bootstrap] Repositorios y servicios inyectados exitosamente.');
  
  // -- TRIGGER INITIAL SCAN --
  const initialScan = async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const allHomes = await repos.homeRepository.findAll();
      for (const h of allHomes) {
        await assistantAssembly.assistantService.scan(h.id, 'system_boot');
      }
      console.log(`[Assistant] Initial system scan completed for ${allHomes.length} homes.`);
    } catch (e) {
      console.error('[Assistant] Initial scan failed:', e);
    }
  };
  initialScan();

  return container;
}
