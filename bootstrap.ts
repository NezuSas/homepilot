import * as path from 'path';
import { SqliteDatabaseManager } from './packages/shared/infrastructure/database/SqliteDatabaseManager';
import { SqliteMigrationsRunner } from './packages/shared/infrastructure/database/SqliteMigrationsRunner';
import { SQLiteHomeRepository } from './packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from './packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import { SQLiteDeviceRepository } from './packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SQLiteAutomationRuleRepository } from './packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SQLiteActivityLogRepository } from './packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { HomeAssistantClient } from './packages/devices/infrastructure/adapters/HomeAssistantClient';

export interface BootstrapContainer {
  repositories: {
    homeRepository: SQLiteHomeRepository;
    roomRepository: SQLiteRoomRepository;
    deviceRepository: SQLiteDeviceRepository;
    automationRuleRepository: SQLiteAutomationRuleRepository;
    activityLogRepository: SQLiteActivityLogRepository;
  };
  adapters: {
    homeAssistantClient: HomeAssistantClient;
  };
}

export interface BootstrapOptions {
  dbPath?: string;
  migrationsDir?: string;
  verbose?: boolean;
}

/**
 * Bootstrap (Composition Root)
 * 
 * Orquesta el arranque del sistema (Edge), garantizando que la base de datos
 * SQLite, su esquema versionado y sus repositorios estén completamente listos 
 * antes de inicializar las capas superiores. Diseñado con inyección y reusabilidad.
 */
export async function bootstrap(options?: BootstrapOptions): Promise<BootstrapContainer> {
  // 1. Configuración: resolver rutas (permite inyección externa o fallback a constantes locales)
  const dbPath = options?.dbPath || process.env.HOMEPILOT_DB_PATH || path.join(__dirname, 'homepilot.local.db');
  const migrationsDir = options?.migrationsDir || path.join(__dirname, 'migrations');
  const isVerbose = options?.verbose ?? process.env.NODE_ENV !== 'production';
  
  console.log(`[Bootstrap] Inicializando persistencia SQLite en: ${dbPath}`);

  // 2. Conexión SQLite a través del Database Manager (singleton determinista)
  const db = SqliteDatabaseManager.getInstance(dbPath, isVerbose);

  // 3. Ejecución de migraciones atómica y versionada usando la tabla _migrations
  console.log(`[Bootstrap] Ejecutando migraciones desde: ${migrationsDir}...`);
  try {
    const runner = new SqliteMigrationsRunner(db);
    runner.run(migrationsDir);
    console.log('[Bootstrap] Migraciones aplicadas/validadas correctamente.');
  } catch (error) {
    console.error('[Bootstrap] Error fatal al aplicar migraciones. Abortando arranque de repositorios.', error);
    throw error; // Se relanza para que el entrypoint corte la ejecución global
  }

  // 4. Creación e inyección de repositorios (Composition Root de Infraestructura)
  // Utilizan exclusivamente la persistencia Durable como define el Spec V1
  console.log('[Bootstrap] Instanciando repositorios SQLite...');
  
  const homeRepository = new SQLiteHomeRepository(dbPath);
  const roomRepository = new SQLiteRoomRepository(dbPath);
  const deviceRepository = new SQLiteDeviceRepository(dbPath);
  const automationRuleRepository = new SQLiteAutomationRuleRepository(dbPath);
  const activityLogRepository = new SQLiteActivityLogRepository(dbPath);

  // 4.1. Adaptadores Externos (Bridge V1)
  const haUrl = process.env.HOME_ASSISTANT_URL || 'http://homeassistant.local:8123';
  const haToken = process.env.HOME_ASSISTANT_TOKEN || '';
  const homeAssistantClient = new HomeAssistantClient(haUrl, haToken);

  // 5. Devolución controlada del contenedor (Container) a la capa llamadora
  const container: BootstrapContainer = {
    repositories: {
      homeRepository,
      roomRepository,
      deviceRepository,
      automationRuleRepository,
      activityLogRepository,
    },
    adapters: {
      homeAssistantClient
    }
  };

  console.log('[Bootstrap] Repositorios inyectados exitosamente. Secuencia terminada.');
  
  return container;
}
