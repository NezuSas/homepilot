/**
 * buildBootstrapContainer.ts
 *
 * Assembler: agrupa los módulos ya construidos en el BootstrapContainer público.
 * No instancia infraestructura nueva; solo mapea resultados de otros assemblers.
 */
import type { BootstrapContainer } from './bootstrapTypes';
import type { RepositoriesAssembly } from './buildRepositories';
import type { EdgeIdentityAssembly, ManifestCatalogAssembly, CloudGatewayServicesAssembly } from './buildCloudGatewayModule';
import type { AssistantAssembly } from './buildAssistantModule';
import type { AssistantRuntimeAssembly } from './buildAssistantRuntime';
import type { HomeAssistantAssembly } from './buildHomeAssistantModule';
import type { AuthModuleAssembly } from './buildAuthModule';
import type { CommandRouterAssembly } from './buildCommandRouter';
import type { NativeCameraAssembly } from './buildNativeCameraModule';
import type { EventBusAssembly } from './buildEventBus';
import type { ModbusService } from '../../packages/integrations/modbus/application/ModbusService';
import type { AndroidDisplayService } from '../../packages/integrations/android-display/application/AndroidDisplayService';
import type { DiagnosticsService } from '../../packages/system-observability/application/DiagnosticsService';
import type { DatabaseBackupService } from '../../packages/shared/infrastructure/database/DatabaseBackupService';
import type { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { SceneExecutionService } from '../../packages/devices/application/SceneExecutionService';
import type { TopologyReferencePort } from '../../packages/devices/application/ports/TopologyReferencePort';
import type { AutomationEngine } from '../../packages/automation/application/AutomationEngine';

export interface BootstrapContainerDeps {
  dbPath: string;
  repos: RepositoriesAssembly;
  edgeIdentity: EdgeIdentityAssembly;
  manifestCatalog: ManifestCatalogAssembly;
  cloudGateway: CloudGatewayServicesAssembly;
  eventBusAssembly: EventBusAssembly;
  topologyReferencePort: TopologyReferencePort;
  haModule: HomeAssistantAssembly;
  authModule: AuthModuleAssembly;
  assistantAssembly: AssistantAssembly;
  assistantRuntime: AssistantRuntimeAssembly;
  nativeCameraModule: NativeCameraAssembly;
  commandRouterAssembly: CommandRouterAssembly;
  modbusService: ModbusService;
  androidDisplayService: AndroidDisplayService;
  systemVariableService: SystemVariableService;
  sceneExecutionService: SceneExecutionService;
  diagnosticsService: DiagnosticsService;
  databaseBackupService: DatabaseBackupService;
  automationEngine: AutomationEngine;
}

export function buildBootstrapContainer(deps: BootstrapContainerDeps): BootstrapContainer {
  const {
    repos, edgeIdentity, manifestCatalog, cloudGateway, eventBusAssembly, haModule, authModule,
    assistantAssembly, assistantRuntime, nativeCameraModule, commandRouterAssembly,
  } = deps;

  return {
    repositories: {
      ...repos,
      manifestCacheRepository: manifestCatalog.manifestCacheRepository,
      deviceBindingRepository: edgeIdentity.deviceBindingRepository,
      userRepository: authModule.userRepository,
      sessionRepository: authModule.sessionRepository,
      directorySsoRepository: authModule.directorySsoRepository,
      systemSetupRepository: authModule.systemSetupRepository
    },
    services: {
      modbusService: deps.modbusService,
      dashboardService: commandRouterAssembly.dashboardService,
      homeAssistantSettingsService: haModule.settingsService,
      diagnosticsService: deps.diagnosticsService,
      authService: authModule.authService,
      systemSetupService: authModule.systemSetupService,
      userManagementService: authModule.userManagementService,
      directorySsoService: authModule.directorySsoService,
      assistantService: assistantAssembly.assistantService,
      assistantActionService: commandRouterAssembly.assistantActionService,
      haImportService: haModule.haImportService,
      systemVariableService: deps.systemVariableService,
      sonoffDiscoveryService: commandRouterAssembly.sonoffDiscoveryService,
      sceneExecutionService: deps.sceneExecutionService,
      databaseBackupService: deps.databaseBackupService,
      intentInterpreterService: assistantRuntime.intentInterpreterService,
      assistantConfirmationPolicy: assistantRuntime.assistantConfirmationPolicy,
      assistantConversationService: assistantRuntime.assistantConversationService,
      assistantTextToSpeechService: assistantRuntime.assistantTextToSpeechService,
      assistantSpeechToTextService: assistantRuntime.assistantSpeechToTextService,
      nativeCameraService: nativeCameraModule.nativeCameraService,
      nativeCameraStreamingService: nativeCameraModule.nativeCameraStreamingService,
      androidDisplayService: deps.androidDisplayService,
      installationVerificationBroker: cloudGateway.installationVerificationBroker,
      edgeDeviceIdentityService: edgeIdentity.edgeDeviceIdentityService,
      manifestSyncService: cloudGateway.manifestSyncService,
      intentFlowCommandExecutionService: cloudGateway.intentFlowCommandExecutionService,
      effectiveActionsProvider: cloudGateway.effectiveActionsProvider,
      deviceControlCatalogProvider: manifestCatalog.deviceControlCatalogProvider
    },
    guards: {
      authGuard: authModule.authGuard
    },
    adapters: {
      homeAssistantConnectionProvider: haModule.connectionProvider,
      homeAssistantClient: haModule.haClientProxy,
      commandDispatcher: commandRouterAssembly.commandDispatcher,
      deviceEventPublisher: eventBusAssembly.deviceEventPublisher,
      topologyEventPublisher: eventBusAssembly.topologyEventPublisher,
      topologyReferencePort: deps.topologyReferencePort
    },
    eventBus: eventBusAssembly.eventBus,
    dbPath: deps.dbPath,
    engine: deps.automationEngine
  };
}
