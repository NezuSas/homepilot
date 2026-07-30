import { TuyaIntegrationService } from '../../packages/integrations/tuya/application/TuyaIntegrationService';
import { SQLiteTuyaSettingsRepository } from '../../packages/integrations/tuya/infrastructure/SQLiteTuyaSettingsRepository';
import { SQLiteDeviceRepository } from '../../packages/devices/infrastructure/repositories/SQLiteDeviceRepository';

export interface TuyaAssembly {
  settingsRepository: SQLiteTuyaSettingsRepository;
  integrationService: TuyaIntegrationService;
}

export function buildTuyaModule(dbPath: string, deviceRepository: SQLiteDeviceRepository): TuyaAssembly {
  const settingsRepository = new SQLiteTuyaSettingsRepository(dbPath);
  const clientId = process.env.TUYA_SHARING_CLIENT_ID?.trim() || '';
  const authEndpoint = process.env.TUYA_SHARING_AUTH_ENDPOINT?.trim() || 'https://apigw.iotbing.com';
  const schema = process.env.TUYA_SHARING_SCHEMA?.trim() || 'homepilotauthorize';
  return {
    settingsRepository,
    integrationService: new TuyaIntegrationService(settingsRepository, deviceRepository, clientId, authEndpoint, schema),
  };
}
