import { HomeAssistantStateReader } from './HomeAssistantStateReader';

export interface HomeAssistantEntityState {
  readonly entity_id: string;
  readonly state: string;
  readonly attributes: Record<string, unknown>;
}

export type HomeAssistantCameraMediaKind = 'snapshot' | 'stream';

/** Cliente de Home Assistant requerido por los casos de uso. */
export interface HomeAssistantClientPort extends HomeAssistantStateReader {
  getEntityState(entityId: string): Promise<HomeAssistantEntityState | null>;
  callService(domain: string, service: string, entityId: string, data?: Record<string, unknown>): Promise<void>;
  getCameraMedia(entityId: string, kind: HomeAssistantCameraMediaKind, signal?: AbortSignal): Promise<Response>;
  getMediaArtwork(artworkPath: string, signal?: AbortSignal): Promise<Response>;
  getCameraHlsStreamPath(entityId: string): Promise<string | null>;
  getCameraHlsMedia(path: string, signal?: AbortSignal): Promise<Response>;
}

/** Fábrica de infraestructura para crear clientes con credenciales vigentes. */
export interface HomeAssistantClientFactory {
  create(baseUrl: string, token: string): HomeAssistantClientPort;
}