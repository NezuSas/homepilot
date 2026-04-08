import { HomeAssistantSettings } from './HomeAssistantSettings';

/**
 * SettingsRepository
 * 
 * Puerto de salida para la persistencia de configuración de Home Assistant.
 */
export interface SettingsRepository {
  /**
   * Recupera los ajustes persistidos.
   */
  getSettings(): Promise<HomeAssistantSettings | null>;

  /**
   * Guarda o actualiza los ajustes (Upsert).
   */
  saveSettings(settings: HomeAssistantSettings): Promise<void>;
}
