import * as fs from 'fs';
import * as path from 'path';
import { SqliteDatabaseManager } from './packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from './packages/shared/infrastructure/database/SqliteMigrationsRunner';
import { SQLiteHomeRepository } from './packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from './packages/topology/infrastructure/repositories/SQLiteRoomRepository';
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
import { CompositeCommandDispatcher } from './apps/api/CompositeCommandDispatcher';
import type { DeviceCommandDispatcherPort } from './packages/devices/application/ports/DeviceCommandDispatcherPort';

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
import { AssistantActionService } from './packages/assistant/application/AssistantActionService';
import { SQLiteTopologyReferenceAdapter } from './packages/topology/infrastructure/adapters/SQLiteTopologyReferenceAdapter';

export interface BootstrapContainer {
  repositories: {
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
  };
  services: {
    homeAssistantSettingsService: HomeAssistantSettingsService;
    diagnosticsService: DiagnosticsService;
    authService: AuthService;
    systemSetupService: SystemSetupService;
    userManagementService: UserManagementService;
    assistantService: AssistantService;
    assistantActionService: AssistantActionService;
    haImportService: HomeAssistantImportService;
  };
  guards: {
    authGuard: AuthGuard;
  };
  adapters: {
    homeAssistantConnectionProvider: HomeAssistantConnectionProvider;
    homeAssistantClient: HomeAssistantClient;
    /** PERF-1: Shared composite command dispatcher — built once, reused per request. */
    commandDispatcher: DeviceCommandDispatcherPort;
  };
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
  const dbPath = options?.dbPath || process.env.HOMEPILOT_DB_PATH || path.join(__dirname, 'homepilot.local.db');
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
  
  const homeRepository = new SQLiteHomeRepository(dbPath);
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

  // Crear un proxy de cliente que siempre lee del provider activo,
  // permitiendo que la reconciliación use credenciales actualizadas post-reconfigure.
  // Se construye como un objeto que delega a getClient() en runtime.
  const haClientProxy = new Proxy({} as HomeAssistantClient, {
    get(_target, prop) {
      return (...args: any[]) => {
        if (!connectionProvider.hasClient()) {
          console.warn(`[Proxy] Home Assistant Client used but not configured (prop: ${String(prop)}).`);
          return Promise.resolve(null);
        }
        const client = connectionProvider.getClient();
        return (client as any)[prop](...args);
      };
    }
  });

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

  const automationEngine = new AutomationEngine(
    automationRuleRepository,
    deviceRepository,
    sceneRepository,
    {
      dispatchCommand: async (homeId, deviceId, command, correlationId) => {
        const executeDeps = {
          deviceRepository,
          eventPublisher: { publish: async () => {} },
          topologyPort: { 
            validateHomeExists: async () => {}, 
            validateHomeOwnership: async () => {}, 
            validateRoomBelongsToHome: async () => {} 
          },
          dispatcherPort: {
            dispatch: async (dId: string, cmd: string) => {
               const target = await deviceRepository.findDeviceById(dId);
               if (!target || !target.externalId.startsWith('ha:')) return;
               const [domain] = target.externalId.split(':')[1].split('.');
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
    { generate: () => crypto.randomUUID() } // idGenerator para AutomationEngine
  );

  syncManager.removeAllListeners('system_event');
  syncManager.on('system_event', (event) => {
    automationEngine.handleSystemEvent(event).catch(e => console.error('[Engine] Fallo asíncrono:', e.message));
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
    activityLogRepository
  );

  // -- INIT AUTH V1 --
  const userRepository = new SqliteUserRepository(db);
  const sessionRepository = new SqliteSessionRepository(db);
  const cryptoService = new CryptoService();
  const authService = new AuthService(userRepository, sessionRepository, cryptoService);
  const authGuard = new AuthGuard(authService);

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

  // -- INIT ASSISTANT V1 --
  const assistantRepository = new SQLiteAssistantFindingRepository(dbPath);
  const assistantDetectionService = new AssistantDetectionService(deviceRepository, haClientProxy);
  const assistantService = new AssistantService(assistantRepository, assistantDetectionService);

  // PERF-1: Build the composite command dispatcher ONCE and reuse it across all request handlers.
  // This eliminates the per-request instantiation of three dispatcher objects.
  const sharedSyncDeps = {
    deviceRepository,
    eventPublisher: { publish: async () => {} },
    activityLogRepository,
    idGenerator: { generate: () => crypto.randomUUID() },
    clock: { now: () => new Date().toISOString() }
  };
  const assistantDiscoveryService = assistantDetectionService; // We can use the detection service as a base or extend it
  const topologyPort = new SQLiteTopologyReferenceAdapter(homeRepository, roomRepository);
  
  const haImportService = new HomeAssistantImportService({
    deviceRepository,
    homeRepository,
    haConnectionProvider: connectionProvider
  });

  const assistantActionService = new AssistantActionService({
    assistantFindingRepository: assistantRepository,
    deviceRepository,
    haImportService,
    assignDeviceDeps: {
      deviceRepository,
      eventPublisher: { publish: async () => {} }, // Replace with real publisher if available
      topologyPort,
      idGenerator: { generate: () => crypto.randomUUID() },
      clock: { now: () => new Date().toISOString() }
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
  const sharedCommandDispatcher = new CompositeCommandDispatcher(
    deviceRepository,
    sharedLocalDispatcher,
    sharedHaDispatcher
  );

  const container: BootstrapContainer = {
    repositories: {
      homeRepository,
      roomRepository,
      deviceRepository,
      sceneRepository,
      automationRuleRepository,
      activityLogRepository,
      settingsRepository,
      userRepository,
      sessionRepository,
      systemSetupRepository
    },
    services: {
      homeAssistantSettingsService: settingsService,
      diagnosticsService,
      authService,
      systemSetupService,
      userManagementService,
      assistantService,
      assistantActionService,
      haImportService
    },
    guards: {
      authGuard
    },
    adapters: {
      homeAssistantConnectionProvider: connectionProvider,
      get homeAssistantClient() {
        return connectionProvider.getClient();
      },
      commandDispatcher: sharedCommandDispatcher
    },
    engine: automationEngine
  };

  console.log('[Bootstrap] Repositorios y servicios inyectados exitosamente.');
  
  // -- TRIGGER INITIAL SCAN --
  // We don't await this to avoid blocking the API server startup
  const initialScan = async () => {
    try {
      const homes = await homeRepository.findHomesByUserId('system'); // Or get first user
      // For now, scan all for system context or just wait for first login
      // Actually, we'll scan when we have a homeId.
      const allHomes = await db.prepare('SELECT id FROM homes').all() as { id: string }[];
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
