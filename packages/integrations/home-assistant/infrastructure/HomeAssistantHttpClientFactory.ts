import { HomeAssistantClient } from '../../../devices/infrastructure/adapters/HomeAssistantClient';
import { HomeAssistantClientFactory, HomeAssistantClientPort } from '../application/ports/HomeAssistantClientPort';

/** Adaptador que construye el cliente HTTP real de Home Assistant. */
export class HomeAssistantHttpClientFactory implements HomeAssistantClientFactory {
  public create(baseUrl: string, token: string): HomeAssistantClientPort {
    return new HomeAssistantClient(baseUrl, token);
  }
}