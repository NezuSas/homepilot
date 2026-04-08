import * as path from 'path';
import { SqliteDatabaseManager } from './packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from './packages/shared/infrastructure/database/SqliteMigrationsRunner';
import { SQLiteHomeRepository } from './packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from './packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import { SQLiteDeviceRepository } from './packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SQLiteAutomationRuleRepository } from './packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SQLiteActivityLogRepository } from './packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { HomeAssistantClient } from './packages/devices/infrastructure/adapters/HomeAssistantClient';
import { SQLiteSettingsRepository } from './packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import { HomeAssistantConnectionProvider } from './packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import { HomeAssistantSettingsService } from './packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import { HomeAssistantRealtimeSyncManager } from './packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';

import { AutomationEngine } from './packages/automation/application/AutomationEngine';

export interface BootstrapContainer {
  repositories: {
    homeRepository: SQLiteHomeRepository;
    roomRepository: SQLiteRoomRepository;
    deviceRepository: SQLiteDeviceRepository;
    automationRuleRepository: SQLiteAutomationRuleRepository;
    activityLogRepository: SQLiteActivityLogRepository;
    settingsRepository: SQLiteSettingsRepository;
  };
  services: {
    homeAssistantSettingsService: HomeAssistantSettingsService;
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
  const migrationsDir = options?.migrationsDir || path.join(__dirname, 'migrations');
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
  const automationRuleRepository = new SQLiteAutomationRuleRepository(dbPath);
  const activityLogRepository = new SQLiteActivityLogRepository(dbPath);
  const settingsRepository = new SQLiteSettingsRepository(dbPath);

  // 4.1. Gestión Dinámica de Home Assistant
  const connectionProvider = new HomeAssistantConnectionProvider();
  
  const envFallback = {
    baseUrl: process.env.HOME_ASSISTANT_URL,
    token: process.env.HOME_ASSISTANT_TOKEN
  };

  const settingsService = new HomeAssistantSettingsService(
    settingsRepository,
    connectionProvider,
    envFallback
  );

  const syncManager = new HomeAssistantRealtimeSyncManager(
    settingsService,
    deviceRepository,
    activityLogRepository
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
    console.warn('[Bootstrap] Home Assistant no configurado (ni DB ni ENV).');
  }

  const automationEngine = new AutomationEngine(
    automationRuleRepository,
    deviceRepository,
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
           await connectionProvider.getClient().callService(domain, service, fullEntityId);
        }
      }
    },
    activityLogRepository
  );

  syncManager.removeAllListeners('system_event');
  syncManager.on('system_event', (event) => {
    automationEngine.handleSystemEvent(event).catch(e => console.error('[Engine] Fallo asíncrono:', e.message));
  });

  const container: BootstrapContainer = {
    repositories: {
      homeRepository,
      roomRepository,
      deviceRepository,
      automationRuleRepository,
      activityLogRepository,
      settingsRepository,
    },
    services: {
      homeAssistantSettingsService: settingsService
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
