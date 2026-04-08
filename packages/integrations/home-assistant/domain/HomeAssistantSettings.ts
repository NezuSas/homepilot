/**
 * HomeAssistantSettings
 * 
 * Persistencia de la configuración de conexión con Home Assistant.
 */
export interface HomeAssistantSettings {
  readonly baseUrl: string;
  readonly accessToken: string;
  readonly updatedAt: string;
}

/**
 * ConfigurationStatus
 * Diferencia si hay datos configurados o no.
 */
export type ConfigurationStatus = 'not_configured' | 'configured';

/**
 * ConnectivityStatus
 * Estado de la comunicación real con HA.
 */
export type ConnectivityStatus = 'unknown' | 'reachable' | 'unreachable' | 'auth_error';

/**
 * ActiveConfigSource
 * Indica de dónde está leyendo el sistema la configuración.
 */
export type ActiveConfigSource = 'database' | 'env-fallback' | 'none';

/**
 * HomeAssistantConnectionStatus
 * Objeto compuesto para el estado de la integración.
 */
export interface HomeAssistantConnectionStatus {
  readonly configurationStatus: ConfigurationStatus;
  readonly connectivityStatus: ConnectivityStatus;
  readonly lastCheckedAt: string | null;
  readonly activeSource: ActiveConfigSource;
}
