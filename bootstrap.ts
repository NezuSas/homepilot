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
import { HomeAssistantRealtimeSyncManager } from './packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import { AutomationEngine } from './packages/automation/application/AutomationEngine';
import { DiagnosticsService } from './packages/system-observability/application/DiagnosticsService';

import { SqliteUserRepository } from './packages/auth/infrastructure/SqliteUserRepository';
import { SqliteSessionRepository } from './packages/auth/infrastructure/SqliteSessionRepository';
import { CryptoService } from './packages/auth/infrastructure/CryptoService';
import { AuthService } from './packages/auth/application/AuthService';
import { AuthGuard } from './packages/auth/infrastructure/AuthGuard';

import { SqliteSystemSetupRepository } from './packages/system-setup/infrastructure/SqliteSystemSetupRepository';
import { SystemSetupService } from './packages/system-setup/application/SystemSetupService';

import { UserManagementService } from './packages/auth/application/UserManagementService';

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
  };
  guards: {
    authGuard: AuthGuard;
  };
  adapters: {
    homeAssistantConnectionProvider: HomeAssistantConnectionProvider;
    homeAssistantClient: HomeAssistantClient;
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
        const target = await deviceRepository.findDeviceById(deviceId);
        if (!target || !target.externalId.startsWith('ha:')) return;
        
        const fullEntityId = target.externalId.split(':')[1];
        const [domain] = fullEntityId.split('.');
        
        let service = '';
        if (command === 'turn_on') service = 'turn_on';
        if (command === 'turn_off') service = 'turn_off';
        if (command === 'toggle') service = 'toggle';
        
        if (service) {
           console.log(`[AutomationEngine] Dispatching HA command: ${domain}.${service} for ${fullEntityId}`);
           await connectionProvider.getClient().callService(domain, service, fullEntityId);
        }
      },
      executeScene: async (homeId, sceneId, correlationId) => {
        const scene = await sceneRepository.findSceneById(sceneId);
        if (!scene) return;

        const syncDeps = {
          deviceRepository: deviceRepository,
          eventPublisher: { publish: async () => {} },
          activityLogRepository: activityLogRepository,
          idGenerator: { generate: () => crypto.randomUUID() },
          clock: { now: () => new Date().toISOString() }
        };

        // Reutilizamos el CompositeCommandDispatcher (que definiremos abajo o inline)
        const localDispatcher = { dispatchCommand: async () => {} }; // Simplificado para automaciones HA mostly
        const haDispatcher = { 
          dispatchCommand: async (hId: string, dId: string, cmd: string) => {
             const target = await deviceRepository.findDeviceById(dId);
             if (!target || !target.externalId.startsWith('ha:')) return;
             const [domain] = target.externalId.split(':')[1].split('.');
             await connectionProvider.getClient().callService(domain, cmd, target.externalId.split(':')[1]);
          }
        };

        for (const action of scene.actions) {
          try {
             await haDispatcher.dispatchCommand(homeId, action.deviceId, action.command);
          } catch (e: any) {
             console.error(`[AutomationEngine] Error in scene action:`, e.message);
          }
        }
      }
    },
    activityLogRepository
  );

  syncManager.removeAllListeners('system_event');
  syncManager.on('system_event', (event) => {
    automationEngine.handleSystemEvent(event).catch(e => console.error('[Engine] Fallo asíncrono:', e.message));
  });

  // 4.2. Latido determinista alineado a fronteras de minuto (HH:mm:00)
  const startHeartbeat = () => {
    const now = new Date();
    const delay = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    
    // Pulso inicial opcional si queremos que arranque YA (pero el usuario quiere alineación a :00)
    // El primer setTimeout nos lleva exactamente al segundo :00 del siguiente minuto.
    setTimeout(() => {
      const triggerPulse = () => {
        const pulseDate = new Date();
        const currentTimeUTC = pulseDate.toISOString().slice(11, 16);
        
        console.log(`[Pulse] Minute Boundary Reached (UTC): ${currentTimeUTC}`);
        automationEngine.handleTimeEvent(currentTimeUTC).catch(e => 
          console.error('[Engine] Fallo en pulso de tiempo:', e.message)
        );
      };

      // Disparar el primer pulso alineado
      triggerPulse();

      // Mantener el ritmo cada 60s exactos desde este punto
      setInterval(triggerPulse, 60000).unref();
    }, delay).unref();

    console.log(`[Bootstrap] Heartbeat scheduled to align in ${delay}ms`);
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
      userManagementService
    },
    guards: {
      authGuard
    },
    adapters: {
      homeAssistantConnectionProvider: connectionProvider,
      get homeAssistantClient() {
        return connectionProvider.getClient();
      }
    },
    engine: automationEngine
  };

  console.log('[Bootstrap] Repositorios y servicios inyectados exitosamente.');
  
  return container;
}
