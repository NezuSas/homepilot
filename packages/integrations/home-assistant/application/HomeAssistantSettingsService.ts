import { SettingsRepository } from '../domain/SettingsRepository';
import { 
  HomeAssistantSettings, 
  HomeAssistantConnectionStatus,
  ConnectivityStatus 
} from '../domain/HomeAssistantSettings';
import { HomeAssistantConnectionProvider } from './HomeAssistantConnectionProvider';

import { HomeAssistantRealtimeSyncManager } from './HomeAssistantRealtimeSyncManager';

/**
 * HomeAssistantSettingsService
 * 
 * Orquesta la lógica de negocio para la gestión de configuración de HA.
 * No depende de HTTP (OperatorConsoleServer lo utiliza).
 */
export class HomeAssistantSettingsService {
  private lastConnectivityStatus: ConnectivityStatus = 'unknown';
  private lastCheckedAt: string | null = null;
  private syncManager: HomeAssistantRealtimeSyncManager | null = null;

  constructor(
    private readonly repository: SettingsRepository,
    private readonly provider: HomeAssistantConnectionProvider,
    private readonly envFallback: { baseUrl?: string; token?: string }
  ) {}

  public setRealtimeSyncManager(manager: HomeAssistantRealtimeSyncManager): void {
    this.syncManager = manager;
  }


  /**
   * Obtiene la configuración actual y su estado consolidado.
   */
  public async getStatus(): Promise<HomeAssistantConnectionStatus & { baseUrl: string; hasToken: boolean; maskedToken: string }> {
    const dbSettings = await this.repository.getSettings();
    
    // Si hay en DB, manda la DB. Si no, manda el fallback.
    const baseUrl = dbSettings?.baseUrl || this.envFallback.baseUrl || '';
    const token = dbSettings?.accessToken || this.envFallback.token || '';
    
    const isConfigured = !!(baseUrl && token);

    return {
      baseUrl,
      hasToken: !!token,
      maskedToken: this.maskToken(token),
      configurationStatus: isConfigured ? 'configured' : 'not_configured',
      connectivityStatus: this.lastConnectivityStatus,
      lastCheckedAt: this.lastCheckedAt,
      activeSource: dbSettings ? 'database' : (this.envFallback.baseUrl ? 'env-fallback' : 'none')
    };
  }

  /**
   * Prueba la conexión con parámetros arbitrarios (sin persistir).
   */
  public async testConnection(baseUrl: string, token: string): Promise<{ success: boolean; status: ConnectivityStatus; error?: string }> {
    try {
      // Usar un cliente temporal para el test
      const tempUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      const response = await fetch(`${tempUrl}/api/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      this.lastCheckedAt = new Date().toISOString();

      if (response.ok) {
        this.lastConnectivityStatus = 'reachable';
        return { success: true, status: 'reachable' };
      }

      if (response.status === 401) {
        this.lastConnectivityStatus = 'auth_error';
        return { success: false, status: 'auth_error', error: 'Invalid access token' };
      }

      this.lastConnectivityStatus = 'unreachable';
      return { success: false, status: 'unreachable', error: `HA error: ${response.status} ${response.statusText}` };

    } catch (error: any) {
      this.lastCheckedAt = new Date().toISOString();
      this.lastConnectivityStatus = 'unreachable';
      return { success: false, status: 'unreachable', error: error.message };
    }
  }

  /**
   * Guarda y activa la nueva configuración.
   */
  public async saveSettings(baseUrl: string, token?: string): Promise<void> {
    const sanitizedUrl = baseUrl.trim().endsWith('/') ? baseUrl.trim().slice(0, -1) : baseUrl.trim();
    
    // Validación básica de URL
    new URL(sanitizedUrl); 

    const current = await this.repository.getSettings();
    const newToken = token || current?.accessToken || '';

    const settings: HomeAssistantSettings = {
      baseUrl: sanitizedUrl,
      accessToken: newToken,
      updatedAt: new Date().toISOString()
    };

    await this.repository.saveSettings(settings);
    
    // Notificar al provider para hot-reload
    this.provider.reconfigure(sanitizedUrl, newToken);
    
    // Notificar al WebSocket sync manager para hot-reload nativo
    if (this.syncManager) {
      this.syncManager.reconnect(sanitizedUrl, newToken);
    }

    // Reset status to unknown to prevent stale indicators from previous config
    this.lastConnectivityStatus = 'unknown';
    this.lastCheckedAt = null;
  }

  /**
   * Actualiza el estado de conectividad basado en una operación real exitosa/fallida.
   */
  public updateStatusFromOperation(status: ConnectivityStatus): void {
    this.lastConnectivityStatus = status;
    this.lastCheckedAt = new Date().toISOString();
  }

  private maskToken(token?: string): string {
    if (!token || token.length < 8) return '••••••••';
    return `${token.substring(0, 4)}••••${token.substring(token.length - 4)}`;
  }
}
