/**
 * bootstrapTypes.ts
 *
 * Contratos públicos del composition root. `bootstrap.ts` los reexporta para
 * conservar la ruta de importación original.
 */
import type { ModbusService } from '../../packages/integrations/modbus/application/ModbusService';
import type { AndroidDisplayService } from '../../packages/integrations/android-display/application/AndroidDisplayService';
import type { DiagnosticsService } from '../../packages/system-observability/application/DiagnosticsService';
import type { InstallationVerificationBroker } from '../../packages/cloud-gateway/application/InstallationVerificationBroker';
import type { ManifestSyncService } from '../../packages/cloud-gateway/application/ManifestSyncService';
import type { EffectiveActionsProvider } from '../../packages/cloud-gateway/application/EffectiveActionsProvider';
import type { DeviceControlCatalogProvider } from '../../packages/cloud-gateway/application/DeviceControlCatalogProvider';
import type { IntentFlowCommandExecutionService } from '../../packages/cloud-gateway/application/IntentFlowCommandExecutionService';
import type { SqliteManifestCacheRepository } from '../../packages/cloud-gateway/infrastructure/SqliteManifestCacheRepository';
import type { EdgeDeviceIdentityService } from '../../packages/cloud-gateway/application/EdgeDeviceIdentityService';
import type { DeviceIdentityProvider } from '../../packages/cloud-gateway/application/DeviceIdentityProvider';
import type { SqliteDeviceBindingRepository } from '../../packages/cloud-gateway/infrastructure/SqliteDeviceBindingRepository';
import type { DatabaseBackupService } from '../../packages/shared/infrastructure/database/DatabaseBackupService';
import type { IntentInterpreterService } from '../../packages/assistant/application/IntentInterpreterService';
import type { AssistantConfirmationPolicy } from '../../packages/assistant/application/AssistantConfirmationPolicy';
import type { AssistantConversationService } from '../../packages/assistant/application/AssistantConversationService';
import type { AssistantTextToSpeechService } from '../../packages/assistant/application/AssistantTextToSpeechService';
import type { AssistantSpeechToTextService } from '../../packages/assistant/application/AssistantSpeechToTextService';
import type { SQLiteDashboardRepository } from '../../packages/topology/infrastructure/repositories/SQLiteDashboardRepository';
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import type { SQLiteRoomRepository } from '../../packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SQLiteNativeCameraSourceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteNativeCameraSourceRepository';
import type { SQLiteAndroidDisplaySourceRepository } from '../../packages/integrations/android-display/infrastructure/SQLiteAndroidDisplaySourceRepository';
import type { SqliteSceneRepository } from '../../packages/devices/infrastructure/repositories/SqliteSceneRepository';
import type { SQLiteAutomationRuleRepository } from '../../packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { SQLiteExecutionRecordRepository } from '../../packages/devices/infrastructure/repositories/SQLiteExecutionRecordRepository';
import type { SQLiteAssistantMemoryRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantMemoryRepository';
import type { SQLiteAssistantLearningRepository } from '../../packages/assistant/infrastructure/repositories/SQLiteAssistantLearningRepository';
import type { SQLiteSettingsRepository } from '../../packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import type { SqliteUserRepository } from '../../packages/auth/infrastructure/SqliteUserRepository';
import type { SqliteSessionRepository } from '../../packages/auth/infrastructure/SqliteSessionRepository';
import type { SqliteDirectorySsoRepository } from '../../packages/auth/infrastructure/SqliteDirectorySsoRepository';
import type { SqliteSystemSetupRepository } from '../../packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import type { SqliteSystemVariableRepository } from '../../packages/system-vars/infrastructure/SqliteSystemVariableRepository';
import type { DashboardService } from '../../packages/topology/application/DashboardService';
import type { HomeAssistantSettingsService } from '../../packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import type { AuthService } from '../../packages/auth/application/AuthService';
import type { SystemSetupService } from '../../packages/system-setup/application/SystemSetupService';
import type { UserManagementService } from '../../packages/auth/application/UserManagementService';
import type { DirectorySsoService } from '../../packages/auth/application/DirectorySsoService';
import type { AssistantService } from '../../packages/assistant/application/AssistantService';
import type { AssistantActionService } from '../../packages/assistant/application/AssistantActionService';
import type { HomeAssistantImportService } from '../../packages/devices/application/HomeAssistantImportService';
import type { SystemVariableService } from '../../packages/system-vars/application/SystemVariableService';
import type { SonoffLanDiscoveryService } from '../../packages/integrations/sonoff/application/SonoffLanDiscoveryService';
import type { AuthGuard } from '../../packages/auth/infrastructure/AuthGuard';
import type { HomeAssistantConnectionProvider } from '../../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import type { HomeAssistantClientPort } from '../../packages/integrations/home-assistant/application/ports/HomeAssistantClientPort';
import type { DeviceCommandDispatcherPort } from '../../packages/devices/application/ports/DeviceCommandDispatcherPort';
import type { TopologyReferencePort } from '../../packages/devices/application/ports/TopologyReferencePort';
import type { EventBusDeviceEventPublisher } from '../../packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import type { EventBusTopologyEventPublisher } from '../../packages/topology/infrastructure/adapters/EventBusTopologyEventPublisher';
import type { EventBus } from '../../packages/shared/domain/events/EventBus';
import type { AutomationEngine } from '../../packages/automation/application/AutomationEngine';
import type { SceneExecutionService } from '../../packages/devices/application/SceneExecutionService';
import type { NativeCameraService } from '../../packages/integrations/native-camera/application/NativeCameraService';
import type { NativeCameraStreamingService } from '../../packages/integrations/native-camera/application/NativeCameraStreamingService';

export interface BootstrapContainer {
  repositories: {
    dashboardRepository: SQLiteDashboardRepository;
    homeRepository: SQLiteHomeRepository;
    roomRepository: SQLiteRoomRepository;
    deviceRepository: SQLiteDeviceRepository;
    nativeCameraSourceRepository: SQLiteNativeCameraSourceRepository;
    androidDisplaySourceRepository: SQLiteAndroidDisplaySourceRepository;
    manifestCacheRepository: SqliteManifestCacheRepository;
    deviceBindingRepository: SqliteDeviceBindingRepository;
    sceneRepository: SqliteSceneRepository;
    automationRuleRepository: SQLiteAutomationRuleRepository;
    activityLogRepository: SQLiteActivityLogRepository;
    executionRecordRepository: SQLiteExecutionRecordRepository;
    assistantMemoryRepository: SQLiteAssistantMemoryRepository;
    assistantLearningRepository: SQLiteAssistantLearningRepository;
    settingsRepository: SQLiteSettingsRepository;
    userRepository: SqliteUserRepository;
    sessionRepository: SqliteSessionRepository;
    directorySsoRepository: SqliteDirectorySsoRepository;
    systemSetupRepository: SqliteSystemSetupRepository;
    systemVariableRepository: SqliteSystemVariableRepository;
  };
  services: {
    modbusService: ModbusService;
    dashboardService: DashboardService;
    homeAssistantSettingsService: HomeAssistantSettingsService;
    diagnosticsService: DiagnosticsService;
    authService: AuthService;
    systemSetupService: SystemSetupService;
    userManagementService: UserManagementService;
    directorySsoService: DirectorySsoService;
    assistantService: AssistantService;
    assistantActionService: AssistantActionService;
    haImportService: HomeAssistantImportService;
    systemVariableService: SystemVariableService;
    sonoffDiscoveryService: SonoffLanDiscoveryService;
    sceneExecutionService: SceneExecutionService;
    databaseBackupService: DatabaseBackupService;
    intentInterpreterService: IntentInterpreterService;
    assistantConfirmationPolicy: AssistantConfirmationPolicy;
    assistantConversationService: AssistantConversationService;
    assistantTextToSpeechService: AssistantTextToSpeechService;
    assistantSpeechToTextService: AssistantSpeechToTextService;
    nativeCameraService: NativeCameraService;
    nativeCameraStreamingService: NativeCameraStreamingService;
    androidDisplayService: AndroidDisplayService;
    installationVerificationBroker: InstallationVerificationBroker;
    edgeDeviceIdentityService: EdgeDeviceIdentityService;
    manifestSyncService: ManifestSyncService;
    effectiveActionsProvider: EffectiveActionsProvider;
    deviceControlCatalogProvider: DeviceControlCatalogProvider;
    intentFlowCommandExecutionService: IntentFlowCommandExecutionService;
  };
  guards: {
    authGuard: AuthGuard;
  };
  adapters: {
    homeAssistantConnectionProvider: HomeAssistantConnectionProvider;
    homeAssistantClient: HomeAssistantClientPort;
    commandDispatcher: DeviceCommandDispatcherPort;
    deviceEventPublisher: EventBusDeviceEventPublisher;
    topologyEventPublisher: EventBusTopologyEventPublisher;
    topologyReferencePort: TopologyReferencePort;
  };
  eventBus: EventBus;
  dbPath: string;
  engine?: AutomationEngine;
}

export interface BootstrapOptions {
  dbPath?: string;
  migrationsDir?: string;
  verbose?: boolean;
  deviceIdentityProvider?: DeviceIdentityProvider;
}
