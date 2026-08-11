import { HomeAssistantClientFactory, HomeAssistantClientPort } from './ports/HomeAssistantClientPort';

/**
 * Gestiona el ciclo de vida del cliente de Home Assistant en memoria.
 * Permite la reconfiguración en caliente sin conocer el transporte HTTP.
 */
export class HomeAssistantConnectionProvider {
  private currentClient: HomeAssistantClientPort | null = null;
  private currentBaseUrl: string | null = null;
  private currentToken: string | null = null;

  constructor(private readonly clientFactory: HomeAssistantClientFactory) {}

  public getClient(): HomeAssistantClientPort {
    if (!this.currentClient) {
      throw new Error('Home Assistant Client not configured. Please check your settings.');
    }
    return this.currentClient;
  }

  public hasClient(): boolean {
    return this.currentClient !== null;
  }

  public reconfigure(baseUrl: string, token: string): void {
    if (this.currentBaseUrl === baseUrl && this.currentToken === token && this.currentClient) {
      return;
    }

    this.currentClient = this.clientFactory.create(baseUrl, token);
    this.currentBaseUrl = baseUrl;
    this.currentToken = token;
  }

  public clear(): void {
    this.currentClient = null;
    this.currentBaseUrl = null;
    this.currentToken = null;
  }
}