/**
 * buildHomeAssistantModule.ts
 *
 * Assembler: construcción del módulo de Home Assistant.
 * Incluye: ConnectionProvider, SettingsService, haClientProxy, SyncManager
 * y la carga inicial de configuración (DB → env fallback).
 */
import { HomeAssistantClient } from '../../packages/devices/infrastructure/adapters/HomeAssistantClient';
import { HomeAssistantConnectionProvider } from '../../packages/integrations/home-assistant/application/HomeAssistantConnectionProvider';
import { HomeAssistantSettingsService } from '../../packages/integrations/home-assistant/application/HomeAssistantSettingsService';
import { HomeAssistantRealtimeSyncManager } from '../../packages/integrations/home-assistant/application/HomeAssistantRealtimeSyncManager';
import { HomeAssistantImportService } from '../../packages/devices/application/HomeAssistantImportService';
import type { SQLiteSettingsRepository } from '../../packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import type { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import type { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import type { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';

export interface HomeAssistantAssembly {
  connectionProvider: HomeAssistantConnectionProvider;
  settingsService: HomeAssistantSettingsService;
  haClientProxy: HomeAssistantClient;
  syncManager: HomeAssistantRealtimeSyncManager;
  haImportService: HomeAssistantImportService;
}

export interface HomeAssistantModuleDeps {
  settingsRepository: SQLiteSettingsRepository;
  deviceRepository: SQLiteDeviceRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  homeRepository: SQLiteHomeRepository;
}

export async function buildHomeAssistantModule(deps: HomeAssistantModuleDeps): Promise<HomeAssistantAssembly> {
  const { settingsRepository, deviceRepository, activityLogRepository, homeRepository } = deps;

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

  // Proxy que siempre delega al cliente activo del provider.
  // Permite que la reconciliación use credenciales actualizadas post-reconfigure.
  const haClientProxy: HomeAssistantClient = {
    getEntityState: (entityId: string) =>
      connectionProvider.hasClient()
        ? connectionProvider.getClient().getEntityState(entityId)
        : Promise.resolve(null),
    callService: (d: string, s: string, e: string) =>
      connectionProvider.hasClient()
        ? connectionProvider.getClient().callService(d, s, e)
        : Promise.resolve(),
    getAllStates: () =>
      connectionProvider.hasClient()
        ? connectionProvider.getClient().getAllStates()
        : Promise.resolve([])
  } as HomeAssistantClient;

  const syncManager = new HomeAssistantRealtimeSyncManager(
    settingsService,
    deviceRepository,
    activityLogRepository,
    haClientProxy
  );
  settingsService.setRealtimeSyncManager(syncManager);

  // Carga inicial: DB → env fallback → sin configuración
  const dbSettings = await settingsRepository.getSettings();
  if (dbSettings) {
    console.log('[Bootstrap] Cargando configuración de HA desde Base de Datos.');
    connectionProvider.reconfigure(dbSettings.baseUrl, dbSettings.accessToken);
    syncManager.reconnect(dbSettings.baseUrl, dbSettings.accessToken);
  } else if (envFallback.baseUrl && envFallback.token) {
    console.log('[Bootstrap] Cargando configuración de HA desde Variables de Entorno (fallback).');
    connectionProvider.reconfigure(envFallback.baseUrl, envFallback.token);
    syncManager.reconnect(envFallback.baseUrl, envFallback.token);
  }

  const haImportService = new HomeAssistantImportService({
    deviceRepository,
    homeRepository,
    haConnectionProvider: connectionProvider
  });

  return { connectionProvider, settingsService, haClientProxy, syncManager, haImportService };
}
