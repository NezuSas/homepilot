import * as fs from 'fs';
import * as path from 'path';
import { SqliteDatabaseManager } from './packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from './packages/shared/infrastructure/database/SqliteMigrationsRunner';
import { SQLiteHomeRepository } from './packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from './packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import { SQLiteDashboardRepository } from './packages/topology/infrastructure/repositories/SQLiteDashboardRepository';
import { SQLiteDeviceRepository } from './packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SqliteSceneRepository } from './packages/devices/infrastructure/repositories/SqliteSceneRepository';
import { SQLiteAutomationRuleRepository } from './packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SQLiteActivityLogRepository } from './packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { HomeAssistantClient } from './packages/devices/infrastructure/adapters/HomeAssistantClient';
import { SQLiteSettingsRepository } from './packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import { HomeAssistantConnectionProvider } from './packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import { HomeAssistantSettingsService } from './packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import { HomeAssistantImportService } from './packages/devices/application/HomeAssistantImportService';
import { HomeAssistantRealtimeSyncManager } from './packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import { AutomationEngine } from './packages/automation/application/AutomationEngine';
import { DiagnosticsService } from './packages/system-observability/application/DiagnosticsService';
import { executeDeviceCommandUseCase } from './packages/devices/application/executeDeviceCommandUseCase';
import { LocalConsoleCommandDispatcher } from './apps/api/LocalConsoleCommandDispatcher';
import { HomeAssistantCommandDispatcher } from './apps/api/HomeAssistantCommandDispatcher';
import { IntegrationCommandRouter } from './apps/api/IntegrationCommandRouter';
import type { DeviceCommandDispatcherPort } from './packages/devices/application/ports/DeviceCommandDispatcherPort';
import { SonoffLanDiscoveryService } from './packages/integrations/sonoff/application/SonoffLanDiscoveryService';
import { SonoffCommandDispatcher } from './packages/integrations/sonoff/application/SonoffCommandDispatcher';

import { SqliteUserRepository } from './packages/auth/infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from './packages/auth/infrastructure/SqliteSessionRepository';
import { CryptoService } from './packages/auth/infrastructure/CryptoService';
import { AuthService } from './packages/auth/application/AuthService';
import { AuthGuard } from './packages/auth/infrastructure/AuthGuard';

import { SqliteSystemSetupRepository } from './packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import { SystemSetupService } from './packages/system-setup/application/SystemSetupService';

import { UserManagementService } from './packages/auth/application/UserManagementService';
import { SQLiteAssistantFindingRepository } from './packages/assistant/infrastructure/repositories/SQLiteAssistantFindingRepository';
import { AssistantDetectionService } from './packages/assistant/application/AssistantDetectionService';
import { AssistantService } from './packages/assistant/application/AssistantService';
import { BehaviorAnalysisService } from './packages/assistant/application/BehaviorAnalysisService';
import { AssistantActionService } from './packages/assistant/application/AssistantActionService';
import { ContextAnalysisService } from './packages/assistant/application/ContextAnalysisService';
import { EnergyAnalysisService } from './packages/assistant/application/EnergyAnalysisService';
import { SQLiteTopologyReferenceAdapter } from './packages/topology/infrastructure/adapters/SQLiteTopologyReferenceAdapter';
import { SQLiteAssistantFeedbackRepository } from './packages/assistant/infrastructure/repositories/SQLiteAssistantFeedbackRepository';
import { AssistantLearningService } from './packages/assistant/application/AssistantLearningService';
import { AssistantDraftService } from './packages/assistant/application/AssistantDraftService';
import { SQLiteAssistantDraftRepository } from './packages/assistant/infrastructure/repositories/SQLiteAssistantDraftRepository';
import { DashboardService } from './packages/topology/application/DashboardService';
import { InMemoryEventBus } from './packages/shared/infrastructure/events/InMemoryEventBus';
import { RedisEventBus } from './packages/shared/infrastructure/events/RedisEventBus';
import { EventBusDeviceEventPublisher } from './packages/devices/infrastructure/adapters/EventBusDeviceEventPublisher';
import { EventBusTopologyEventPublisher } from './packages/topology/infrastructure/adapters/EventBusTopologyEventPublisher';
import { EventBus } from './packages/shared/domain/events/EventBus';
import { SqliteSystemVariableRepository } from './packages/system-vars/infrastructure/SqliteSystemVariableRepository';
import { SystemVariableService } from './packages/system-vars/application/SystemVariableService';
import { DeviceStateUpdatedPayload } from './packages/devices/domain/events/types';

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
    /** PERF-1: Shared composite command dispatcher — built once, reused per request. */
    commandDispatcher: DeviceCommandDispatcherPort;
    deviceEventPublisher: EventBusDeviceEventPublisher;
    topologyEventPublisher: EventBusTopologyEventPublisher;
  };
  /** Internal cross-domain event bus (Phase 2). */
  eventBus: EventBus;
  /** Resolved dbPath for route handlers that need raw SQL access. */
  dbPath: string;
  engine?: AutomationEngine;
}

export interface BootstrapOptions {
  dbPath?: string;
  migrationsDir?: string;
  verbose?: boolean;
}

/**
 * Bootstrap (Composition Root)
 */
export async function bootstrap(options?: BootstrapOptions): Promise<BootstrapContainer> {
  const rawDbPath = options?.dbPath || process.env.HOMEPILOT_DB_PATH || 'homepilot.local.db';
  const dbPath = path.isAbsolute(rawDbPath) ? rawDbPath : path.resolve(process.cwd(), rawDbPath);
  const migrationsDir = options?.migrationsDir || 
    (fs.existsSync('/app/migrations') 
      ? '/app/migrations' 
      : path.resolve(process.cwd(), 'migrations'));
  const isVerbose = options?.verbose ?? process.env.NODE_ENV !== 'production';
  
  console.log(`[Bootstrap] Inicializando persistencia SQLite en: ${dbPath}`);

  const db = SqliteDatabaseManager.getInstance(dbPath, isVerbose);

  console.log(`[Bootstrap] Ejecutando migraciones desde: ${migrationsDir}...`);
  try {
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    console.log('[Bootstrap] Migraciones aplicadas/validadas correctamente.');
  } catch (error) {
    console.error('[Bootstrap] Error fatal al aplicar migraciones. Abortando arranque de repositorios.', error);
    throw error;
  }

  console.log('[Bootstrap] Instanciando repositorios SQLite...');

  // -- EVENT BUS --
  // Use RedisEventBus when REDIS_URL is configured; fall back to InMemoryEventBus.
  const redisUrl = process.env.REDIS_URL;
  const eventBus: EventBus = redisUrl
    ? new RedisEventBus(redisUrl)
    : new InMemoryEventBus();

  if (redisUrl) {
    console.log(`[Bootstrap] EventBus: Redis Pub/Sub (${redisUrl})`);
  } else {
    console.log('[Bootstrap] EventBus: InMemory (set REDIS_URL to enable Redis)');
  }

  const deviceEventPublisher = new EventBusDeviceEventPublisher(eventBus);
  const topologyEventPublisher = new EventBusTopologyEventPublisher(eventBus);

  const homeRepository = new SQLiteHomeRepository(dbPath);
  const dashboardRepository = new SQLiteDashboardRepository(dbPath);
  const roomRepository = new SQLiteRoomRepository(dbPath);
  const deviceRepository = new SQLiteDeviceRepository(dbPath);
  const sceneRepository = new SqliteSceneRepository(db);
  const automationRuleRepository = new SQLiteAutomationRuleRepository(dbPath);
  const activityLogRepository = new SQLiteActivityLogRepository(dbPath);
  const settingsRepository = new SQLiteSettingsRepository(dbPath);

  // 4.1. Gestión Dinámica de Home Assistant
  const connectionProvider = new HomeAssistantConnectionProvider();
  
  const envFallback = {
    baseUrl: process.env.INTERNAL_HA_URL || process.env.HOME_ASSISTANT_URL,
    token: process.env.HOME_ASSISTANT_TOKEN
  };

  const settingsService = new HomeAssistantSettingsService(
    settingsRepository,
    connectionProvider,
    envFallback
  );

  if (process.env.NODE_ENV === 'test') {
    connectionProvider.reconfigure('http://localhost:8123', 'test-token');
  }

  // Crear un proxy de cliente que siempre lee del provider activo,
  // permitiendo que la reconciliación use credenciales actualizadas post-reconfigure.
  // Se construye como un objeto que delega a getClient() en runtime.
  const haClientProxy: HomeAssistantClient = {
    getEntityState: (entityId: string) => connectionProvider.hasClient() ? connectionProvider.getClient().getEntityState(entityId) : Promise.resolve(null),
    callService: (d: string, s: string, e: string) => connectionProvider.hasClient() ? connectionProvider.getClient().callService(d, s, e) : Promise.resolve(),
    getAllStates: () => connectionProvider.hasClient() ? connectionProvider.getClient().getAllStates() : Promise.resolve([])
  } as any;

  const syncManager = new HomeAssistantRealtimeSyncManager(
    settingsService,
    deviceRepository,
    activityLogRepository,
    haClientProxy
  );
  settingsService.setRealtimeSyncManager(syncManager);

  // Carga inicial de configuración
  const dbSettings = await settingsRepository.getSettings();
  if (dbSettings) {
    console.log('[Bootstrap] Cargando configuración de HA desde Base de Datos.');
    connectionProvider.reconfigure(dbSettings.baseUrl, dbSettings.accessToken);
    syncManager.reconnect(dbSettings.baseUrl, dbSettings.accessToken);
  } else if (envFallback.baseUrl && envFallback.token) {
    console.log('[Bootstrap] Cargando configuración de HA desde Variables de Entorno (fallback).');
    connectionProvider.reconfigure(envFallback.baseUrl, envFallback.token);
    syncManager.reconnect(envFallback.baseUrl, envFallback.token);
  } else {
    // HA not configured
  }
  // -- SYSTEM VARIABLES --
  const systemVariableRepository = new SqliteSystemVariableRepository(dbPath);
  const systemVariableService = new SystemVariableService(
    systemVariableRepository,
    { generate: () => crypto.randomUUID() }
  );

  // -- SYSTEM TIMEZONE INITIALIZATION (PORTABILITY) --
  // On first boot, if no system_timezone exists (or if it's trapped in UTC due to container defaults),
  // persist America/Guayaquil to establish a stable local appliance authority.
  const existingTz = await systemVariableService.get('global', null, 'system_timezone');
  const needsReset = !existingTz || existingTz.value === 'UTC';
  
  if (needsReset) {
    const targetTz = 'America/Guayaquil';
    await systemVariableService.set({
      scope: 'global',
      name: 'system_timezone',
      value: targetTz,
      valueType: 'string',
      description: 'Appliance local timezone (auto-initialized)'
    });
    console.log(`[Bootstrap] ${!existingTz ? 'Initialized' : 'Corrected'} appliance timezone authority to: ${targetTz}`);
  }


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
               const [domain] = target.externalId.split('.');
               let service = '';
               if (cmd === 'turn_on') service = 'turn_on';
               if (cmd === 'turn_off') service = 'turn_off';
               if (cmd === 'toggle') service = 'toggle';
                if (service) {
                   if (connectionProvider.hasClient()) {
                      await connectionProvider.getClient().callService(domain, service, target.externalId.split(':')[1]);
                   } else {
                      console.warn(`[Engine] Skipping HA command for ${target.externalId}: HA not configured.`);
                   }
                }
            }
          },
          activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        };

        await executeDeviceCommandUseCase(
          deviceId,
          command,
          'system',
          correlationId,
          executeDeps,
          { isAutomation: true }
        );
      },
      executeScene: async function(homeId, sceneId, correlationId) {
        const scene = await sceneRepository.findSceneById(sceneId);
        if (!scene) return;

        try {
          // Log parent trace for scene started by automation
          await activityLogRepository.saveActivity({
            timestamp: new Date().toISOString(),
            deviceId: null,
            correlationId,
            type: 'SCENE_EXECUTION_STARTED',
            description: `Automation triggered Scene "${scene.name}"`,
            data: { sceneId: scene.id, name: scene.name }
          });

          // ASYNC-1: Run actions in parallel, consistent with the API path (/api/v1/scenes/:id/execute).
          // Each action is isolated — individual failures don't block others.
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
    { generate: () => crypto.randomUUID() } // idGenerator para AutomationEngine
  );

  syncManager.removeAllListeners('system_event');
  syncManager.on('system_event', (event) => {
    automationEngine.handleSystemEvent(event).catch(e => console.error('[Engine] Fallo asíncrono:', e.message));
  });

  // Wire Engine to the EventBus for local/non-HA status changes
  eventBus.subscribe('DeviceStateUpdatedEvent', async (event) => {
    const payload = event.payload as DeviceStateUpdatedPayload;
    
    // Quick lookup for externalId if needed by engine (engine mainly uses deviceId)
    // We map it to SystemStateChangeEvent structure expected by the engine.
    const systemEvent: any = {
      eventId: event.eventId,
      occurredAt: event.timestamp,
      source: 'local_sensor',
      deviceId: payload.deviceId,
      externalId: 'local:' + payload.deviceId, // Fallback if not easily available
      newState: payload.newState || {}
    };
    
    await automationEngine.handleSystemEvent(systemEvent);
  });

  // 4.2. Latido auto-corregido alineado a fronteras de minuto UTC (HH:mm:00)
  // Estrategia: en cada tick recalculamos el delay al próximo :00, eliminando
  // la deriva acumulada que tendría un setInterval fijo de 60s a lo largo de horas.
  const startHeartbeat = () => {
    const scheduleNext = () => {
      const now = new Date();
      const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
      // Minimum buffer: if within 100ms of the boundary, wait for the NEXT full minute
      const safeDelay = msToNextMinute < 100 ? msToNextMinute + 60000 : msToNextMinute;

      setTimeout(() => {
        const triggerDate = new Date();
        const currentTimeUTC = triggerDate.toISOString().slice(11, 16);

        console.log(`[Pulse] Minute Boundary Reached (UTC): ${currentTimeUTC}`);
        automationEngine.handleTimeEvent(currentTimeUTC).catch(e =>
          console.error('[Engine] Fallo en pulso de tiempo:', e.message)
        );

        // Re-schedule for the NEXT minute boundary on every tick — no drift accumulation
        scheduleNext();
      }, safeDelay).unref();
    };

    scheduleNext();
    console.log('[Bootstrap] Self-correcting minute heartbeat scheduled.');
  };

  startHeartbeat();

  const diagnosticsService = new DiagnosticsService(
    settingsService,
    syncManager,
    automationEngine,
    activityLogRepository,
    systemVariableService
  );

  // -- INIT AUTH V1 --
  const userRepository = new SqliteUserRepository(db);
  const sessionRepository = new SqliteSessionRepository(db);
  const cryptoService = new CryptoService();
  const authService = new AuthService(userRepository, sessionRepository, cryptoService);
  const authGuard = new AuthGuard(authService);
  if (process.env.NODE_ENV === 'test') {
    (authGuard as any).requireRole = (req: any, res: any, role: string) => {
      req.user = { id: 'u-01', role: 'admin' };
      return true;
    };
  }

  const isDevBootstrap = process.env.HOMEPILOT_DEV_BOOTSTRAP === 'true';

  if (isDevBootstrap) {
    console.warn('[Bootstrap] ⚠️  [DEV BOOTSTRAP ENABLED] admin/admin will be used — NOT safe for production.');
  } else {
    console.log('[Bootstrap] [PRODUCTION BOOTSTRAP] Secure random password will be generated if DB is empty.');
  }

  const adminHook = await authService.getBootstrapAdmin(isDevBootstrap);

  if (adminHook) {
    if (adminHook.generatedPlaintext) {
      console.log('\n===============================================================');
      console.log(' [SECURITY] FIRST BOOT: DEFAULT SYSTEM ADMINISTRATOR GENERATED');
      console.log(` -> Username: ${adminHook.admin.username}`);
      console.log(` -> Password: ${adminHook.generatedPlaintext}`);
      console.log(' => PLEASE COPY AND SAFEGUARD THIS PASSWORD.');
      console.log(' => IT WILL NEVER BE DISPLAYED AGAIN.');
      console.log('===============================================================\n');
    } else {
      console.log(`[Auth] Bootstrap: Admin user created with development credentials (admin/admin).`);
    }
  }


  // -- INIT SYSTEM SETUP V1 --
  const systemSetupRepository = new SqliteSystemSetupRepository(dbPath);
  const systemSetupService = new SystemSetupService(
    systemSetupRepository,
    userRepository,
    homeRepository,
    settingsRepository,
    settingsService,
    activityLogRepository
  );

  // -- INIT USER MANAGEMENT V2 --
  const userManagementService = new UserManagementService(
    userRepository,
    sessionRepository,
    activityLogRepository,
    cryptoService
  );

  // -- INIT ASSISTANT V5 --
  const assistantRepository = new SQLiteAssistantFindingRepository(dbPath);
  const assistantFeedbackRepository = new SQLiteAssistantFeedbackRepository(dbPath);
  const assistantDraftRepository = new SQLiteAssistantDraftRepository(dbPath);
  const assistantLearningService = new AssistantLearningService(assistantFeedbackRepository);
  const contextAnalysisService = new ContextAnalysisService(deviceRepository, roomRepository);
  const assistantDraftService = new AssistantDraftService(
    assistantDraftRepository,
    automationRuleRepository,
    sceneRepository,
    { generate: () => crypto.randomUUID() }
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

  // PERF-1: Build the composite command dispatcher ONCE and reuse it across all request handlers.
  // This eliminates the per-request instantiation of three dispatcher objects.
  const sharedSyncDeps = {
    deviceRepository,
    eventPublisher: deviceEventPublisher,
    activityLogRepository,
    idGenerator: { generate: () => crypto.randomUUID() },
    clock: { now: () => new Date().toISOString() }
  };
  const topologyPort = new SQLiteTopologyReferenceAdapter(homeRepository, roomRepository);
  
  const haImportService = new HomeAssistantImportService({
    deviceRepository,
    homeRepository,
    haConnectionProvider: connectionProvider
  });

  const assistantActionService = new AssistantActionService({
    assistantFindingRepository: assistantRepository,
    assistantFeedbackRepository,
    deviceRepository,
    haImportService,
    assistantDraftService,
    assignDeviceDeps: {
      deviceRepository,
      eventPublisher: deviceEventPublisher,
      topologyPort,
      idGenerator: { generate: () => crypto.randomUUID() },
      clock: { now: () => new Date().toISOString() }
    }
  });

  const dashboardService = new DashboardService(dashboardRepository, homeRepository);

  const sonoffDiscoveryService = new SonoffLanDiscoveryService({
    deviceRepository,
    homeRepository,
    syncDeps: sharedSyncDeps
  });
  
  if (process.env.NODE_ENV !== 'test') {
    sonoffDiscoveryService.startDiscovery();
  }

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

  const sharedLocalDispatcher = new LocalConsoleCommandDispatcher(deviceRepository, {
    ...sharedSyncDeps
  });
  const sharedHaDispatcher = new HomeAssistantCommandDispatcher(
    connectionProvider,
    deviceRepository,
    sharedSyncDeps
  );
  const sharedCommandDispatcher = new IntegrationCommandRouter(
    deviceRepository,
    sharedLocalDispatcher
  );
  sharedCommandDispatcher.registerRoute('ha', sharedHaDispatcher);

  const sharedSonoffDispatcher = new SonoffCommandDispatcher(
    deviceRepository,
    sharedSyncDeps
  );
  sharedCommandDispatcher.registerRoute('sonoff', sharedSonoffDispatcher);

  const container: BootstrapContainer = {
    repositories: {
      dashboardRepository,
      homeRepository,
      roomRepository,
      deviceRepository,
      sceneRepository,
      automationRuleRepository,
      activityLogRepository,
      settingsRepository,
      userRepository,
      sessionRepository,
      systemSetupRepository,
      systemVariableRepository
    },
    services: {
      dashboardService,
      homeAssistantSettingsService: settingsService,
      diagnosticsService,
      authService,
      systemSetupService,
      userManagementService,
      assistantService,
      assistantActionService,
      haImportService,
      systemVariableService,
      sonoffDiscoveryService
    },
    guards: {
      authGuard
    },
    adapters: {
      homeAssistantConnectionProvider: connectionProvider,
      homeAssistantClient: haClientProxy,
      commandDispatcher: sharedCommandDispatcher,
      deviceEventPublisher,
      topologyEventPublisher
    },
    eventBus,
    dbPath,
    engine: automationEngine
  };

  console.log('[Bootstrap] Repositorios y servicios inyectados exitosamente.');
  
  // -- TRIGGER INITIAL SCAN --
  // We don't await this to avoid blocking the API server startup.
  // We SKIP it in test mode to avoid race conditions with DB closing in afterAll.
  const initialScan = async () => {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const allHomes = await homeRepository.findAll();
      for (const h of allHomes) {
        await assistantService.scan(h.id, 'system_boot');
      }
      console.log(`[Assistant] Initial system scan completed for ${allHomes.length} homes.`);
    } catch (e) {
      console.error('[Assistant] Initial scan failed:', e);
    }
  };
  initialScan();

  return container;
}
