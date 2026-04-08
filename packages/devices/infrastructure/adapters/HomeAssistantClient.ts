/**
 * HomeAssistantState
 * Contrato mínimo de la respuesta de estado de Home Assistant.
 */
export interface HomeAssistantState {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Record<string, unknown>;
  readonly last_changed: string;
  readonly last_updated: string;
}

/**
 * HomeAssistantClient
 * 
 * Cliente minimalista para interactuar con la API REST de Home Assistant.
 * Diseñado para ser un Bridge táctico (V1) sin dependencias de SDK externas.
 */
export class HomeAssistantClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string
  ) {}

  /**
   * Obtiene el estado actual de una entidad de Home Assistant.
   */
  public async getEntityState(entityId: string): Promise<HomeAssistantState | null> {
    const url = `${this.baseUrl}/api/states/${entityId}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Home Assistant API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as HomeAssistantState;
  }

  /**
   * Ejecuta un servicio en Home Assistant.
   */
  public async callService(domain: string, service: string, entityId: string): Promise<void> {
    const url = `${this.baseUrl}/api/services/${domain}/${service}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entity_id: entityId })
    });

    if (!response.ok) {
      throw new Error(`Home Assistant Service Error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * Obtiene todos los estados de las entidades de Home Assistant.
   */
  public async getAllStates(): Promise<HomeAssistantState[]> {
    const url = `${this.baseUrl}/api/states`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Home Assistant API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as HomeAssistantState[];
  }
}
