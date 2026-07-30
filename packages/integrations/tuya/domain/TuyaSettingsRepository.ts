import { TuyaSettings } from './TuyaSettings';

export interface TuyaSettingsRepository {
  getSettings(): Promise<TuyaSettings | null>;
  saveSettings(settings: TuyaSettings): Promise<void>;
}