import { TuyaIntegrationService } from '../../packages/integrations/tuya/application/TuyaIntegrationService';
import { SQLiteTuyaSettingsRepository } from '../../packages/integrations/tuya/infrastructure/SQLiteTuyaSettingsRepository';
import { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';

export interface TuyaAssembly { settingsRepository: SQLiteTuyaSettingsRepository; integrationService: TuyaIntegrationService; }

export function buildTuyaModule(dbPath: string, deviceRepository: SQLiteDeviceRepository): TuyaAssembly {
  const settingsRepository = new SQLiteTuyaSettingsRepository(dbPath);
  return { settingsRepository, integrationService: new TuyaIntegrationService(settingsRepository, deviceRepository) };
}