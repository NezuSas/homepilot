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

export type HomeAssistantCameraMediaKind = 'snapshot' | 'stream';

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
    const timeout = parseInt(process.env.HA_STATE_TIMEOUT_MS || process.env.HA_COMMAND_TIMEOUT_MS || '8000', 10);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
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
    } catch (err: unknown) {
      if (this.isAbortError(err)) {
        throw new Error(`getEntityState(${entityId}) timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Ejecuta un servicio en Home Assistant.
   * Extendido para soportar payloads opcionales (Command Params V1).
   */
  public async callService(domain: string, service: string, entityId: string, data?: Record<string, unknown>): Promise<void> {
    const url = `${this.baseUrl}/api/services/${domain}/${service}`;
    const timeout = parseInt(process.env.HA_COMMAND_TIMEOUT_MS || '8000', 10);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout); 
    const t0 = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          entity_id: entityId,
          ...data 
        })
      });

      if (process.env.NODE_ENV !== 'production') {
        console.debug(`[HomeAssistantClient] callService took ${Date.now() - t0}ms`);
      }

      if (!response.ok) {
        throw new Error(`Home Assistant Service Error: ${response.status} ${response.statusText}`);
      }
    } catch (error: unknown) {
      if (this.isAbortError(error)) {
        throw new Error(`HA_SERVICE_CALL_TIMEOUT: ${domain}/${service} timed out after ${timeout}ms`);
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`HA_SERVICE_CALL_FAILED: ${message}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Obtiene medios de una entidad camera usando su token limitado de acceso.
   * El token administrativo de Home Assistant nunca se entrega al navegador.
   */
  public async getCameraMedia(
    entityId: string,
    kind: HomeAssistantCameraMediaKind,
    signal?: AbortSignal,
  ): Promise<Response> {
    const endpoint = kind === 'stream' ? 'camera_proxy_stream' : 'camera_proxy';
    const url = `${this.baseUrl}/api/${endpoint}/${encodeURIComponent(entityId)}`;

    return fetch(url, {
      signal,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: kind === 'stream' ? 'multipart/x-mixed-replace,image/jpeg' : 'image/jpeg',
      },
    });
  }

  /**
   * Obtiene todos los estados de las entidades de Home Assistant.
   */
  /**
   * Timeout configurable en ms para la reconciliación. Por defecto: 8 segundos.
   */
  private getReconciliationTimeout(): number {
    return parseInt(process.env.HA_RECONCILIATION_TIMEOUT_MS || '8000', 10);
  }

  public async getAllStates(): Promise<HomeAssistantState[]> {
    const url = `${this.baseUrl}/api/states`;
    const timeout = this.getReconciliationTimeout();
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      timeout
    );

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Home Assistant API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json() as HomeAssistantState[];
    } catch (err: unknown) {
      if (this.isAbortError(err)) {
        throw new Error(`getAllStates() timed out after ${timeout}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Helper seguro para identificar errores de aborto de fetch.
   */
  private isAbortError(error: unknown): boolean {
    if (error instanceof Error && error.name === 'AbortError') return true;
    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') return true;
    return false;
  }
}
