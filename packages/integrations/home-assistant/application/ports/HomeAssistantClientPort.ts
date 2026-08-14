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
  /**
   * Best-effort lookup of the entity registry entry for `entityId` (integration
   * platform such as `onvif`, `matter`, `esphome`, etc.). Optional so existing
   * fakes/mocks of this port are unaffected; callers must treat its absence the
   * same as a lookup failure (fall back to a legacy default, never block).
   */
  getEntityRegistryEntry?(entityId: string): Promise<{ platform: string } | null>;
}

/** Fábrica de infraestructura para crear clientes con credenciales vigentes. */
export interface HomeAssistantClientFactory {
  create(baseUrl: string, token: string): HomeAssistantClientPort;
}