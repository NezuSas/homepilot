import * as http from 'http';
import { BootstrapContainer } from '../../../bootstrap';
import { HomePilotRequest } from '../../../packages/shared/domain/http';
import type { NativeCameraSourceRepository } from '../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraStreamingService } from '../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { ApiRoutes } from './ApiRoutes';
import { CameraHlsSessionStore, NATIVE_HLS_REAPER_INTERVAL_MS } from './camera/CameraHlsSessionStore';
import { CameraHlsProxyRoutes } from './camera/CameraHlsProxyRoutes';
import { CameraMediaProxyRoutes } from './camera/CameraMediaProxyRoutes';
import { CameraSessionRoutes } from './camera/CameraSessionRoutes';

type CameraRouteGroup = CameraHlsProxyRoutes | CameraMediaProxyRoutes | CameraSessionRoutes;

/**
 * Camera routes: /api/v1/devices/:id/camera/(hls|snapshot|stream|session)
 *
 * Punto de entrada: compone los grupos de `./camera/` (proxy HLS, proxy de medios y
 * sesión) sobre un único almacén de sesiones HLS.
 */
export class CameraRoutes extends ApiRoutes {
  private readonly sessionStore: CameraHlsSessionStore;
  private readonly groups: ReadonlyArray<CameraRouteGroup>;

  constructor(
    nativeCameraSourceRepository?: NativeCameraSourceRepository,
    nativeCameraStreamingService?: NativeCameraStreamingService,
  ) {
    super();
    this.sessionStore = new CameraHlsSessionStore(nativeCameraStreamingService);
    this.groups = [
      new CameraHlsProxyRoutes(this.sessionStore),
      new CameraMediaProxyRoutes(nativeCameraSourceRepository, nativeCameraStreamingService),
      new CameraSessionRoutes(this.sessionStore, nativeCameraSourceRepository, nativeCameraStreamingService),
    ];
    const reaper = setInterval(() => this.sessionStore.reapInactiveNativeHls(), NATIVE_HLS_REAPER_INTERVAL_MS);
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
}
