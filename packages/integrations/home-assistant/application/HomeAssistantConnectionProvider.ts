import { HomeAssistantClient } from '../../../devices/infrastructure/adapters/HomeAssistantClient';

/**
 * HomeAssistantConnectionProvider
 * 
 * Gestiona el ciclo de vida del cliente de Home Assistant en memoria.
 * Permite la reconfiguración en caliente (hot reload) sin reiniciar el sistema.
 */
export class HomeAssistantConnectionProvider {
  private currentClient: HomeAssistantClient | null = null;
  private currentBaseUrl: string | null = null;
  private currentToken: string | null = null;

  /**
   * Obtiene la instancia activa del cliente.
   * Lanza error si no hay una configuración válida cargada.
   */
  public getClient(): HomeAssistantClient {
    if (!this.currentClient) {
      throw new Error('Home Assistant Client not configured. Please check your settings.');
    }
    return this.currentClient;
  }

  /**
   * Indica si hay un cliente configurado.
   */
  public hasClient(): boolean {
    return this.currentClient !== null;
  }

  /**
   * Reconfigura el cliente en caliente.
   * Si los parámetros no han cambiado, mantiene la instancia actual.
   */
  public reconfigure(baseUrl: string, token: string): void {
    if (this.currentBaseUrl === baseUrl && this.currentToken === token && this.currentClient) {
      return; 
    }

    console.log(`[HA-Provider] Reconfigurando cliente: ${baseUrl}`);
    this.currentClient = new HomeAssistantClient(baseUrl, token);
    this.currentBaseUrl = baseUrl;
    this.currentToken = token;
  }

  /**
   * Limpia el cliente activo.
   */
  public clear(): void {
    this.currentClient = null;
    this.currentBaseUrl = null;
    this.currentToken = null;
  }
}
