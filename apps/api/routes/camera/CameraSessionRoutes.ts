import * as http from 'http';
import * as path from 'path';
import { BootstrapContainer } from '../../../../bootstrap';
import { HomePilotRequest } from '../../../../packages/shared/domain/http';
import type { NativeCameraSourceRepository } from '../../../../packages/devices/domain/repositories/NativeCameraSourceRepository';
import type { NativeCameraStreamingService } from '../../../../packages/integrations/native-camera/application/NativeCameraStreamingService';
import { ApiRoutes } from '../ApiRoutes';
import { CameraHlsSessionStore } from './CameraHlsSessionStore';
import { createCameraProxyToken } from './cameraProxyToken';
import { buildCameraMediaPaths, resolveCameraEntityId } from './cameraEntity';

interface CameraSessionResponse {
  readonly snapshotPath: string;
  readonly streamPath: string;
  readonly hlsPath?: string;
}

/**
 * GET /api/v1/devices/:id/camera/session — authenticated; issues the proxy token
 * and the media paths (snapshot, stream, optional HLS) for a camera.
 */
export class CameraSessionRoutes extends ApiRoutes {
  constructor(
    private readonly store: CameraHlsSessionStore,
    private readonly nativeCameraSourceRepository?: NativeCameraSourceRepository,
    private readonly nativeCameraStreamingService?: NativeCameraStreamingService,
  ) {
    super();
  }

  private static match(pathname: string, method: string): RegExpMatchArray | null {
    return method === 'GET'
      ? pathname.match(/^\/api\/v1\/devices\/([^/]+)\/camera\/session$/)
      : null;
  }

  /** Comprobación síncrona para que CameraRoutes despache sin ceder el turno antes de tiempo. */
  matches(pathname: string, method: string): boolean {
    return CameraSessionRoutes.match(pathname, method) !== null;
  }

  async handle(
    req: HomePilotRequest,
    res: http.ServerResponse,
    pathname: string,
    method: string,
    container: BootstrapContainer,
  ): Promise<boolean> {
    const sessionMatch = CameraSessionRoutes.match(pathname, method);

    if (!sessionMatch) return false;

    const isProtected = await container.guards.authGuard.protect(req, res, true);
    if (!isProtected) return true;

    try {
      const requestUrl = new URL(req.url || pathname, 'http://localhost');
      const includeHls = requestUrl.searchParams.get('includeHls') === 'true';
      const device = await container.repositories.deviceRepository.findDeviceById(sessionMatch[1]);
      const entityId = resolveCameraEntityId(device);
      if (!device || !entityId) {
        this.sendError(res, 404, 'DEVICE_NOT_FOUND', 'Camera device not found');
        return true;
      }

      if (device.integrationSource === 'native-camera') {
        const nativeSource = this.nativeCameraSourceRepository?.findByDeviceId(device.id) ?? null;
        if (!nativeSource || !nativeSource.enabled) {
          this.sendError(res, 409, 'CAMERA_UNAVAILABLE', 'Native camera is not configured');
          return true;
        }

        const cameraProxyToken = createCameraProxyToken(device.id);
        const mediaPaths = buildCameraMediaPaths(device.id, cameraProxyToken);
        let hlsPath: string | undefined;
        if (includeHls) {
          this.store.beginNativeStart(device.id);
          try {
            const runtime = await this.nativeCameraStreamingService!.ensureHlsRuntime(device.id, nativeSource);
            this.store.register(cameraProxyToken, device.id, path.join(runtime.directory, 'index.m3u8'), 'native', runtime.directory);
            hlsPath = mediaPaths.hlsPath;
          } finally {
            this.store.endNativeStart(device.id);
          }
        }
        this.sendJson(res, {
          snapshotPath: mediaPaths.snapshotPath,
          streamPath: mediaPaths.streamPath,
          ...(hlsPath ? { hlsPath } : {}),
        });
        return true;
      }

      const state = await container.adapters.homeAssistantClient.getEntityState(entityId);
      if (!state || state.state === 'unavailable') {
        this.sendError(res, 409, 'CAMERA_UNAVAILABLE', `Camera ${entityId} is unavailable`);
        return true;
      }

      const cameraProxyToken = createCameraProxyToken(device.id);
      const mediaPaths = buildCameraMediaPaths(device.id, cameraProxyToken);
      let hlsMasterPath: string | null = null;
      if (includeHls) {
        try {
          hlsMasterPath = await container.adapters.homeAssistantClient.getCameraHlsStreamPath(entityId);
        } catch {
          hlsMasterPath = null;
        }
      }

      const response: CameraSessionResponse = {
        snapshotPath: mediaPaths.snapshotPath,
        streamPath: mediaPaths.streamPath,
        ...(hlsMasterPath ? { hlsPath: mediaPaths.hlsPath } : {}),
      };
      if (hlsMasterPath) this.store.register(cameraProxyToken, device.id, hlsMasterPath, 'home-assistant');
      this.sendJson(res, response);
    } catch (error: unknown) {
      console.error('[CAMERA_SESSION_ERROR]', error);
      const errorMessage = error instanceof Error ? error.message : 'Camera session failed';
      if (errorMessage === 'NATIVE_CAMERA_AUTH_FAILED') {
        this.sendError(res, 400, 'NATIVE_CAMERA_AUTH_FAILED', 'Camera RTSP credentials rejected');
      } else if (errorMessage === 'NATIVE_CAMERA_STREAM_TIMEOUT') {
        this.sendError(res, 502, 'NATIVE_CAMERA_STREAM_TIMEOUT', 'Camera HLS stream timed out');
      } else {
        this.sendError(res, 502, 'CAMERA_MEDIA_ERROR', errorMessage);
      }
    }

    return true;
  }
}
