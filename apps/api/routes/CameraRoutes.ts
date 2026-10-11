import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { Device } from '../../../packages/devices/domain/types';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { NativeCameraSourceRepository } from '../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraStreamingService } from '../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { ApiRoutes } from './ApiRoutes';
import { CameraHlsProxySession, CameraHlsSessionStore, NATIVE_HLS_REAPER_INTERVAL_MS } from './camera/CameraHlsSessionStore';
import { CameraHlsProxyRoutes } from './camera/CameraHlsProxyRoutes';
import { CameraMediaProxyRoutes } from './camera/CameraMediaProxyRoutes';
import { CameraSessionRoutes } from './camera/CameraSessionRoutes';
import { createCameraProxyToken, verifyCameraProxyToken } from './camera/cameraProxyToken';
import { resolveCameraEntityId } from './camera/cameraEntity';
import { HlsRewriteSession, resolveHlsPath, rewriteHlsManifest } from './camera/hlsManifest';

type CameraRouteGroup = CameraHlsProxyRoutes | CameraMediaProxyRoutes | CameraSessionRoutes;

/**
 * Camera routes: /api/v1/devices/:id/camera/(hls|snapshot|stream|session)
 *
 * Punto de entrada: compone los grupos de `./camera/` (proxy HLS, proxy de medios y
 * sesión) sobre un único almacén de sesiones HLS.
 */
export class CameraRoutes extends ApiRoutes {
  private readonly sessionStore: CameraHlsSessionStore;
  private readonly hlsProxyRoutes: CameraHlsProxyRoutes;
  private readonly groups: ReadonlyArray<CameraRouteGroup>;

  constructor(
    nativeCameraSourceRepository?: NativeCameraSourceRepository,
    nativeCameraStreamingService?: NativeCameraStreamingService,
  ) {
    super();
    this.sessionStore = new CameraHlsSessionStore(nativeCameraStreamingService);
    this.hlsProxyRoutes = new CameraHlsProxyRoutes(this.sessionStore);
    this.groups = [
      this.hlsProxyRoutes,
      new CameraMediaProxyRoutes(nativeCameraSourceRepository, nativeCameraStreamingService),
      new CameraSessionRoutes(this.sessionStore, nativeCameraSourceRepository, nativeCameraStreamingService),
    ];
    const reaper = setInterval(() => this.reapInactiveNativeHls(), NATIVE_HLS_REAPER_INTERVAL_MS);
    reaper.unref?.();
  }

  handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    // Despacho síncrono: el grupo elegido arranca en el mismo turno que la solicitud.
    const group = this.groups.find((candidate) => candidate.matches(pathname, method));
    return group ? group.handle(req, res, pathname, method, container) : Promise.resolve(false);
  }

  // Delegados de compatibilidad: las pruebas existentes inspeccionan estos
  // miembros internos de CameraRoutes; la lógica vive en ./camera/.

  protected get hlsSessions(): Map<string, CameraHlsProxySession> {
    return this.sessionStore.sessions;
  }

  protected reapInactiveNativeHls(): void {
    this.sessionStore.reapInactiveNativeHls();
  }

  protected createCameraProxyToken(deviceId: string): string {
    return createCameraProxyToken(deviceId);
  }

  protected verifyCameraProxyToken(token: string, deviceId: string): boolean {
    return verifyCameraProxyToken(token, deviceId);
  }

  protected resolveCameraEntityId(device: Device | null): string | null {
    return resolveCameraEntityId(device);
  }

  protected registerHlsSession(
    token: string,
    deviceId: string,
    masterPath: string,
    source: CameraHlsProxySession['source'],
    nativeDirectory?: string,
  ): void {
    this.sessionStore.register(token, deviceId, masterPath, source, nativeDirectory);
  }

  protected rewriteHlsManifest(manifest: string, currentUpstreamPath: string, session: HlsRewriteSession, token: string): string {
    return rewriteHlsManifest(manifest, currentUpstreamPath, session, token);
  }

  protected resolveHlsPath(currentPath: string, uri: string): string {
    return resolveHlsPath(currentPath, uri);
  }

  protected serveNativeHlsResource(res: http.ServerResponse, session: CameraHlsProxySession, filePath: string | undefined): Promise<void> {
    return this.hlsProxyRoutes.serveNativeHlsResource(res, session, filePath);
  }
}
