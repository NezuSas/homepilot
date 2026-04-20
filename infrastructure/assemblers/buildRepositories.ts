/**
 * buildRepositories.ts
 *
 * Assembler: instanciación de todos los repositorios SQLite de dominio.
 * No contiene lógica de negocio — solo wiring de infraestructura.
 */
import { SQLiteHomeRepository } from '../../packages/topology/infrastructure/repositories/SQLiteHomeRepository';
import { SQLiteRoomRepository } from '../../packages/topology/infrastructure/repositories/SQLiteRoomRepository';
import { SQLiteDashboardRepository } from '../../packages/topology/infrastructure/repositories/SQLiteDashboardRepository';
import { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';
import { SqliteSceneRepository } from '../../packages/devices/infrastructure/repositories/SqliteSceneRepository';
import { SQLiteAutomationRuleRepository } from '../../packages/devices/infrastructure/repositories/SQLiteAutomationRuleRepository';
import { SQLiteActivityLogRepository } from '../../packages/devices/infrastructure/repositories/SQLiteActivityLogRepository';
import { SQLiteSettingsRepository } from '../../packages/integrations/home-assistant/infrastructure/SQLiteSettingsRepository';
import { SqliteSystemVariableRepository } from '../../packages/system-vars/infrastructure/SqliteSystemVariableRepository';
import type { SqliteDatabaseManager } from '../../packages/shared/infrastructure/database/SqliteDatabaseManager';

export interface RepositoriesAssembly {
  homeRepository: SQLiteHomeRepository;
  dashboardRepository: SQLiteDashboardRepository;
  roomRepository: SQLiteRoomRepository;
  deviceRepository: SQLiteDeviceRepository;
  sceneRepository: SqliteSceneRepository;
  automationRuleRepository: SQLiteAutomationRuleRepository;
  activityLogRepository: SQLiteActivityLogRepository;
  settingsRepository: SQLiteSettingsRepository;
  systemVariableRepository: SqliteSystemVariableRepository;
}

export function buildRepositories(
  dbPath: string,
  db: ReturnType<typeof SqliteDatabaseManager.getInstance>
): RepositoriesAssembly {
  return {
    homeRepository: new SQLiteHomeRepository(dbPath),
    dashboardRepository: new SQLiteDashboardRepository(dbPath),
    roomRepository: new SQLiteRoomRepository(dbPath),
    deviceRepository: new SQLiteDeviceRepository(dbPath),
    sceneRepository: new SqliteSceneRepository(db),
    automationRuleRepository: new SQLiteAutomationRuleRepository(dbPath),
    activityLogRepository: new SQLiteActivityLogRepository(dbPath),
    settingsRepository: new SQLiteSettingsRepository(dbPath),
    systemVariableRepository: new SqliteSystemVariableRepository(dbPath),
  };
}
