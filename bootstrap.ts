import { buildDatabase } from './infrastructure/assemblers/buildDatabase';
import { buildEventBus } from './infrastructure/assemblers/buildEventBus';
import { buildRepositories } from './infrastructure/assemblers/buildRepositories';
import { buildHomeAssistantModule } from './infrastructure/assemblers/buildHomeAssistantModule';
import { SQLiteExpiredInboxDeviceRemover } from './packages/devices/infrastructure/repositories/SQLiteExpiredInboxDeviceRemover';
import { buildSystemVarsModule } from './infrastructure/assemblers/buildSystemVarsModule';
import { buildAutomationModule } from './infrastructure/assemblers/buildAutomationModule';
import { buildAuthModule } from './infrastructure/assemblers/buildAuthModule';
import { buildAssistantModule } from './infrastructure/assemblers/buildAssistantModule';
import { buildAssistantRuntime } from './infrastructure/assemblers/buildAssistantRuntime';
import { buildCommandRouter } from './infrastructure/assemblers/buildCommandRouter';
import { buildNativeCameraModule } from './infrastructure/assemblers/buildNativeCameraModule';
import { buildModbusModule } from './infrastructure/assemblers/buildModbusModule';
import {
  buildEdgeIdentity,
  buildManifestCatalog,
  buildCloudGatewayServices,
} from './infrastructure/assemblers/buildCloudGatewayModule';
import { buildBootstrapContainer } from './infrastructure/assemblers/buildBootstrapContainer';
import { startInitialAssistantScan } from './infrastructure/assemblers/startInitialAssistantScan';
import type { BootstrapContainer, BootstrapOptions } from './infrastructure/assemblers/bootstrapTypes';
import { HttpAndroidDisplayBridgeClient } from './packages/integrations/android-display/infrastructure/HttpAndroidDisplayBridgeClient';
import { AndroidDisplayService } from './packages/integrations/android-display/application/AndroidDisplayService';
import { DiagnosticsService } from './packages/system-observability/application/DiagnosticsService';
import { RepositoryTopologyReferenceAdapter } from './packages/devices/infrastructure/adapters/RepositoryTopologyReferenceAdapter';
import { getDatabasePath } from './packages/shared/config/getDatabasePath';
import { DatabaseBackupService } from './packages/shared/infrastructure/database/DatabaseBackupService';
import fs from 'fs';

export type { BootstrapContainer, BootstrapOptions };

/**
 * Bootstrap (Composition Root) - Refactorizado como orquestador liviano.
 */
export async function bootstrap(options?: BootstrapOptions): Promise<BootstrapContainer> {
  const isVerbose = options?.verbose ?? false;

  const resolvedDbPath = options?.dbPath || getDatabasePath();

  if (!fs.existsSync(resolvedDbPath)) {
    console.warn('[HomePilot] Database file does not exist, it will be created');
  }

  console.log(`[HomePilot] Using SQLite DB: ${resolvedDbPath}`);

  // 1. Persistencia y Eventos (Core Infrastructure)
  const { db, dbPath } = buildDatabase({
    rawDbPath: resolvedDbPath,
    migrationsDir: options?.migrationsDir,
    verbose: isVerbose
  });

  const edgeIdentity = await buildEdgeIdentity({
    db,
    dbPath,
    deviceIdentityProvider: options?.deviceIdentityProvider,
  });

  const eventBusAssembly = buildEventBus();
  const { eventBus, deviceEventPublisher, topologyEventPublisher } = eventBusAssembly;

  // 2. Repositorios y Módulos Base
  const repos = buildRepositories(dbPath, db);
  const manifestCatalog = buildManifestCatalog(dbPath, repos.deviceRepository);
  const topologyReferencePort = new RepositoryTopologyReferenceAdapter(
    repos.homeRepository,
    repos.roomRepository
  );

  const haModule = await buildHomeAssistantModule({
    settingsRepository: repos.settingsRepository,
    deviceRepository: repos.deviceRepository,
    activityLogRepository: repos.activityLogRepository,
    homeRepository: repos.homeRepository,
    eventBus,
    expiredInboxDeviceRemover: new SQLiteExpiredInboxDeviceRemover(db),
  });


  const { systemVariableService } = await buildSystemVarsModule({
    systemVariableRepository: repos.systemVariableRepository
  });

  // 3. Seguridad y Onboarding
  const authModule = await buildAuthModule({
    db,
    dbPath,
    homeRepository: repos.homeRepository,
    settingsRepository: repos.settingsRepository,
    settingsService: haModule.settingsService,
    activityLogRepository: repos.activityLogRepository
  });

  // 4. Assistant (necesario por buildCommandRouter)
  const assistantAssembly = buildAssistantModule({
    dbPath,
    getSystemTimezone: () => systemVariableService.getSystemTimezone(),
    deviceRepository: repos.deviceRepository,
    roomRepository: repos.roomRepository,
    automationRuleRepository: repos.automationRuleRepository,
    sceneRepository: repos.sceneRepository,
    activityLogRepository: repos.activityLogRepository,
    haClientProxy: haModule.haClientProxy,
    eventBus
  });

  // 4b. Cámaras nativas (necesario por buildCommandRouter para registrar el driver PTZ)
  const nativeCameraModule = buildNativeCameraModule({
    nativeCameraSourceRepository: repos.nativeCameraSourceRepository,
    deviceRepository: repos.deviceRepository,
    homeRepository: repos.homeRepository,
  });

  const androidDisplayBridge = HttpAndroidDisplayBridgeClient.fromEnvironment();
  const modbusService = buildModbusModule(dbPath, repos.homeRepository, {
    deviceRepository: repos.deviceRepository, eventPublisher: deviceEventPublisher,
    activityLogRepository: repos.activityLogRepository,
  });
  const androidDisplayService = new AndroidDisplayService(
    repos.androidDisplaySourceRepository, repos.homeRepository, androidDisplayBridge,
  );

  // 5. Enrutamiento de Comandos (debe construirse antes del motor de automatización)
  const commandRouterAssembly = buildCommandRouter({
    expiredInboxDeviceRemover: new SQLiteExpiredInboxDeviceRemover(db),
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
    dashboardRepository: repos.dashboardRepository,
    sceneRepository: repos.sceneRepository,
    automationRuleRepository: repos.automationRuleRepository,
    deviceControlCatalogProvider: manifestCatalog.deviceControlCatalogProvider,
    nativeCameraSourceRepository: repos.nativeCameraSourceRepository,
    nativeCameraDriverRegistry: nativeCameraModule.nativeCameraDriverRegistry,
    androidDisplaySourceRepository: repos.androidDisplaySourceRepository,
    androidDisplayBridge,
    modbusDriver: modbusService,
  });

  // 6. Motor de Automatización (usa el commandDispatcher ya construido)
  const { automationEngine, sceneExecutionService } = buildAutomationModule({
    automationRuleRepository: repos.automationRuleRepository,
    deviceRepository: repos.deviceRepository,
    sceneRepository: repos.sceneRepository,
    activityLogRepository: repos.activityLogRepository,
    executionRecordRepository: repos.executionRecordRepository,
    commandDispatcher: commandRouterAssembly.commandDispatcher,
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

  const databaseBackupService = new DatabaseBackupService();

  // 7. Runtime conversacional del asistente (voz, conversación)
  const assistantRuntime = buildAssistantRuntime({
    repos,
    assistantDraftService: assistantAssembly.assistantDraftService,
    commandDispatcher: commandRouterAssembly.commandDispatcher,
    sceneExecutionService,
    systemVariableService,
    topologyEventPublisher,
  });

  // 8. Cloud gateway (manifiestos y ejecución de comandos IntentFlow)
  const cloudGateway = buildCloudGatewayServices({
    manifestCacheRepository: manifestCatalog.manifestCacheRepository,
    deviceRepository: repos.deviceRepository,
    edgeDeviceIdentityService: edgeIdentity.edgeDeviceIdentityService,
  });

  const container = buildBootstrapContainer({
    dbPath,
    repos,
    edgeIdentity,
    manifestCatalog,
    cloudGateway,
    eventBusAssembly,
    topologyReferencePort,
    haModule,
    authModule,
    assistantAssembly,
    assistantRuntime,
    nativeCameraModule,
    commandRouterAssembly,
    modbusService,
    androidDisplayService,
    systemVariableService,
    sceneExecutionService,
    diagnosticsService,
    databaseBackupService,
    automationEngine,
  });

  console.log('[Bootstrap] Repositorios y servicios inyectados exitosamente.');

  // -- TRIGGER INITIAL SCAN --
  startInitialAssistantScan({
    homeRepository: repos.homeRepository,
    assistantService: assistantAssembly.assistantService,
  });

  return container;
}
